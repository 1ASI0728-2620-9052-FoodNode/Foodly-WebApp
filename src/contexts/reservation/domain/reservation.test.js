import { describe, expect, it } from 'vitest';
import {
  RESERVATION_STATUS as S,
  buildNotes,
  canTransition,
  dayCounters,
  dayOfWeek,
  expireIfStale,
  isFinal,
  isWithinOpeningHours,
  ownerTabOf,
  parseNotes,
  reservationCode,
  toReservation,
  validateReservationForm,
} from './reservation.js';

// 2026-11-25 is a Wednesday. "now" is that day at 10:00.
const NOW = new Date(2026, 10, 25, 10, 0, 0);
const HOURS = [
  { day: 'WEDNESDAY', opensAt: '12:00', closesAt: '16:00' },
  { day: 'WEDNESDAY', opensAt: '18:00', closesAt: '22:00' },
  { day: 'THURSDAY', opensAt: '12:00', closesAt: '22:00' },
];

describe('reservation status transitions', () => {
  it('allows the PENDING -> APPROVED / REJECTED / EXPIRED paths', () => {
    expect(canTransition(S.PENDING, S.APPROVED)).toBe(true);
    expect(canTransition(S.PENDING, S.REJECTED)).toBe(true);
    expect(canTransition(S.PENDING, S.EXPIRED)).toBe(true);
  });

  it('only an APPROVED reservation can be COMPLETED (check-in) or expire', () => {
    expect(canTransition(S.APPROVED, S.COMPLETED)).toBe(true);
    expect(canTransition(S.APPROVED, S.EXPIRED)).toBe(true);
    expect(canTransition(S.PENDING, S.COMPLETED)).toBe(false);
    expect(canTransition(S.APPROVED, S.REJECTED)).toBe(false);
    expect(canTransition(S.APPROVED, S.PENDING)).toBe(false);
  });

  it('REJECTED, EXPIRED and COMPLETED are final', () => {
    for (const status of [S.REJECTED, S.EXPIRED, S.COMPLETED]) {
      expect(isFinal(status)).toBe(true);
      for (const target of Object.values(S)) expect(canTransition(status, target)).toBe(false);
    }
    expect(isFinal(S.PENDING)).toBe(false);
    expect(isFinal(S.APPROVED)).toBe(false);
  });

  it('an unknown status transitions nowhere', () => {
    expect(canTransition('NOPE', S.APPROVED)).toBe(false);
  });

  it('expires a PENDING reservation whose time has passed, and only that', () => {
    const past = { date: '2026-11-25', time: '09:00' };
    const future = { date: '2026-11-25', time: '20:00' };
    expect(expireIfStale({ ...past, status: S.PENDING }, NOW).status).toBe(S.EXPIRED);
    expect(expireIfStale({ ...future, status: S.PENDING }, NOW).status).toBe(S.PENDING);
    expect(expireIfStale({ ...past, status: S.APPROVED }, NOW).status).toBe(S.APPROVED);
  });

  it('groups statuses in the owner tabs; COMPLETED counts as approved', () => {
    expect(ownerTabOf(S.PENDING)).toBe('pending');
    expect(ownerTabOf(S.APPROVED)).toBe('approved');
    expect(ownerTabOf(S.COMPLETED)).toBe('approved');
    expect(ownerTabOf(S.REJECTED)).toBe('closed');
    expect(ownerTabOf(S.EXPIRED)).toBe('closed');
  });
});

describe('opening hours validation', () => {
  it('maps a date to the Business DayOfWeek name', () => {
    expect(dayOfWeek('2026-11-25')).toBe('WEDNESDAY');
    expect(dayOfWeek('2026-11-29')).toBe('SUNDAY');
    expect(dayOfWeek('2026-11-30')).toBe('MONDAY');
  });

  it('accepts a time inside any opening range of that weekday, closing time excluded', () => {
    expect(isWithinOpeningHours(HOURS, '2026-11-25', '12:00')).toBe(true);
    expect(isWithinOpeningHours(HOURS, '2026-11-25', '15:59')).toBe(true);
    expect(isWithinOpeningHours(HOURS, '2026-11-25', '16:00')).toBe(false);
    expect(isWithinOpeningHours(HOURS, '2026-11-25', '17:00')).toBe(false); // the break between shifts
    expect(isWithinOpeningHours(HOURS, '2026-11-25', '18:00')).toBe(true);
    expect(isWithinOpeningHours(HOURS, '2026-11-25', '22:00')).toBe(false);
    expect(isWithinOpeningHours(HOURS, '2026-11-25', '11:59')).toBe(false);
  });

  it('rejects any time on a day without hours', () => {
    expect(isWithinOpeningHours(HOURS, '2026-11-27', '13:00')).toBe(false); // Friday
  });

  const form = (patch) => ({
    date: '2026-11-25',
    time: '20:00',
    partySize: 4,
    notes: '',
    ...patch,
  });
  const check = (patch) => validateReservationForm(form(patch), { openingHours: HOURS, now: NOW });

  it('accepts a valid reservation', () => {
    expect(check({}).valid).toBe(true);
  });

  it('explains the hours of that day when the time is outside them', () => {
    const { errors } = check({ time: '17:00' });
    expect(errors.time).toContain('12:00 – 16:00 y 18:00 – 22:00');
  });

  it('says the huarique does not attend that weekday', () => {
    const { errors } = check({ date: '2026-11-27', time: '13:00' });
    expect(errors.time).toMatch(/no atiende los días viernes/);
  });

  it('rejects past dates and times that already passed today', () => {
    expect(check({ date: '2026-11-24' }).errors.date).toBeTruthy();
    expect(check({ time: '12:00' }).valid).toBe(true); // 12:00 is after "now" (10:00)
    const late = validateReservationForm(form({ time: '12:00' }), {
      openingHours: HOURS,
      now: new Date(2026, 10, 25, 13, 0),
    });
    expect(late.errors.time).toMatch(/ya pasó/);
  });

  it('validates party size (1-20) and notes length', () => {
    expect(check({ partySize: 0 }).errors.partySize).toBeTruthy();
    expect(check({ partySize: 21 }).errors.partySize).toBeTruthy();
    expect(check({ partySize: 2.5 }).errors.partySize).toBeTruthy();
    expect(check({ partySize: '6' }).valid).toBe(true);
    expect(check({ notes: 'x'.repeat(501) }).errors.notes).toBeTruthy();
  });

  it('requires date and time', () => {
    const { errors } = check({ date: '', time: '' });
    expect(errors.date).toBeTruthy();
    expect(errors.time).toBeTruthy();
  });
});

describe('notes convention and normalization', () => {
  it('round-trips dish of interest, Lía note and free notes', () => {
    const notes = buildNotes({
      notes: 'Mesa junto a la ventana',
      dishOfInterest: 'Ceviche',
      liaNote: 'Reserva solicitada desde el chat con Lía.',
    });
    expect(parseNotes(notes)).toEqual({
      dishOfInterest: 'Ceviche',
      liaNote: 'Reserva solicitada desde el chat con Lía.',
      notes: 'Mesa junto a la ventana',
    });
    expect(buildNotes({})).toBe('');
  });

  it('normalizes a service reservation and derives a code', () => {
    const reservation = toReservation({
      id: '65f1c2a9-e4b0-4a1d-8c3f-4a5b6c7d8e9f',
      huariqueId: 'h1',
      date: '2026-11-25',
      time: '20:00:00',
      partySize: '4',
      status: 'PENDING',
      notes: 'Plato de interés: Ceviche',
    });
    expect(reservation).toMatchObject({
      time: '20:00',
      partySize: 4,
      dishOfInterest: 'Ceviche',
      dinerName: 'Comensal',
    });
    expect(reservation.code).toBe('FD-65F1C2');
    expect(reservationCode({ id: 'x', code: 'ABC' })).toBe('ABC');
  });

  it('counts the day: total, pending, approved (incl. completed) and guests', () => {
    const list = [
      { date: '2026-11-25', status: S.PENDING, partySize: 2 },
      { date: '2026-11-25', status: S.APPROVED, partySize: 4 },
      { date: '2026-11-25', status: S.COMPLETED, partySize: 3 },
      { date: '2026-11-25', status: S.REJECTED, partySize: 9 },
      { date: '2026-11-26', status: S.APPROVED, partySize: 5 },
    ];
    expect(dayCounters(list, '2026-11-25')).toEqual({
      total: 4,
      pending: 1,
      approved: 2,
      guests: 7,
    });
  });
});
