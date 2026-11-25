import { DAY_ORDER, DAY_LABELS } from '../../business/domain/huarique.js';

/**
 * Reservation rules (informe 5.5.2). The Reservation service has no implementation yet, so the
 * state machine and the schedule check live here and the mock adapter relies on them too.
 */

export const RESERVATION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  COMPLETED: 'COMPLETED',
});

const S = RESERVATION_STATUS;

/** Allowed transitions. REJECTED, EXPIRED and COMPLETED are final. */
const TRANSITIONS = Object.freeze({
  [S.PENDING]: [S.APPROVED, S.REJECTED, S.EXPIRED],
  [S.APPROVED]: [S.COMPLETED, S.EXPIRED],
  [S.REJECTED]: [],
  [S.EXPIRED]: [],
  [S.COMPLETED]: [],
});

export function canTransition(from, to) {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function isFinal(status) {
  return (TRANSITIONS[status] ?? []).length === 0;
}

/** Statuses of the StatusBadge vocabulary (always text + icon). */
export const BADGE_BY_STATUS = Object.freeze({
  [S.PENDING]: 'pending',
  [S.APPROVED]: 'approved',
  [S.REJECTED]: 'rejected',
  [S.EXPIRED]: 'expired',
  [S.COMPLETED]: 'completed',
});

export const PARTY_SIZE_MIN = 1;
export const PARTY_SIZE_MAX = 20;
export const NOTES_MAX = 500;

// --- date helpers (local time; dates are 'YYYY-MM-DD', times 'HH:mm') ---------------------------

export const pad = (n) => String(n).padStart(2, '0');

export function toDateString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toTimeString(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Local Date of a reservation's date + time. */
export function reservationDateTime({ date, time }) {
  return new Date(`${date}T${time}:00`);
}

/** 'YYYY-MM-DD' -> DayOfWeek name as Business uses it ('MONDAY'...). */
export function dayOfWeek(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const index = new Date(year, month - 1, day).getDay(); // 0 = Sunday
  return DAY_ORDER[(index + 6) % 7];
}

const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** The slots of the huarique that day, e.g. "12:00 – 22:00", for hints and error messages. */
export function hoursLabelFor(openingHours, dateString) {
  const day = dayOfWeek(dateString);
  const slots = openingHours.filter((slot) => slot.day === day);
  return {
    day: DAY_LABELS[day],
    text: slots.length ? slots.map((s) => `${s.opensAt} – ${s.closesAt}`).join(' y ') : 'cerrado',
  };
}

/** The reservation time must fall inside one opening range of that weekday (closing time excluded). */
export function isWithinOpeningHours(openingHours, dateString, time) {
  const day = dayOfWeek(dateString);
  const minutes = toMinutes(time);
  return openingHours.some(
    (slot) =>
      slot.day === day && minutes >= toMinutes(slot.opensAt) && minutes < toMinutes(slot.closesAt),
  );
}

/**
 * @returns {{ errors: Record<string, string>, valid: boolean }}
 * @param {{ date: string, time: string, partySize: number|string, notes: string }} form
 * @param {{ openingHours: object[], now?: Date }} context
 */
export function validateReservationForm(form, { openingHours, now = new Date() }) {
  const errors = {};
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(form.date);
  const timeOk = /^([01]\d|2[0-3]):[0-5]\d$/.test(form.time);

  if (!dateOk) errors.date = 'Elige la fecha de tu reserva.';
  else if (form.date < toDateString(now)) errors.date = 'La fecha no puede ser anterior a hoy.';

  if (!timeOk) errors.time = 'Elige la hora de tu reserva.';
  else if (dateOk && !errors.date) {
    if (!isWithinOpeningHours(openingHours, form.date, form.time)) {
      const { day, text } = hoursLabelFor(openingHours, form.date);
      errors.time =
        text === 'cerrado'
          ? `El huarique no atiende los días ${day.toLowerCase()}.`
          : `Elige una hora dentro del horario del ${day.toLowerCase()}: ${text}.`;
    } else if (reservationDateTime(form) <= now) {
      errors.time = 'La hora ya pasó. Elige una hora posterior a la actual.';
    }
  }

  const size = Number(form.partySize);
  if (!Number.isInteger(size) || size < PARTY_SIZE_MIN || size > PARTY_SIZE_MAX) {
    errors.partySize = `Indica entre ${PARTY_SIZE_MIN} y ${PARTY_SIZE_MAX} personas.`;
  }
  if ((form.notes ?? '').length > NOTES_MAX) errors.notes = `Máximo ${NOTES_MAX} caracteres.`;

  return { errors, valid: Object.keys(errors).length === 0 };
}

/** A PENDING reservation whose time has passed without an answer is EXPIRED (what the server will do). */
export function expireIfStale(reservation, now = new Date()) {
  return reservation.status === S.PENDING && reservationDateTime(reservation) <= now
    ? { ...reservation, status: S.EXPIRED }
    : reservation;
}

// --- notes convention ------------------------------------------------------------------------
// The contract has a single free `notes` field. The dish of interest and Lía's note travel inside
// it, one per line, and are read back for the owner's card.

const DISH_PREFIX = 'Plato de interés: ';
const LIA_PREFIX = 'Nota de Lía: ';

export function buildNotes({ notes = '', dishOfInterest = '', liaNote = '' }) {
  return [
    dishOfInterest && `${DISH_PREFIX}${dishOfInterest.trim()}`,
    liaNote && `${LIA_PREFIX}${liaNote.trim()}`,
    notes.trim(),
  ]
    .filter(Boolean)
    .join('\n');
}

export function parseNotes(raw = '') {
  const result = { dishOfInterest: '', liaNote: '', notes: [] };
  for (const line of String(raw).split('\n')) {
    if (line.startsWith(DISH_PREFIX)) result.dishOfInterest = line.slice(DISH_PREFIX.length);
    else if (line.startsWith(LIA_PREFIX)) result.liaNote = line.slice(LIA_PREFIX.length);
    else if (line.trim()) result.notes.push(line);
  }
  return { ...result, notes: result.notes.join('\n') };
}

/** Human code shown on the digital pass. */
export function reservationCode(reservation) {
  return (
    reservation.code ?? `FD-${String(reservation.id).replace(/-/g, '').slice(0, 6).toUpperCase()}`
  );
}

/** Normalizes whatever the service answers into the shape the UI uses. */
export function toReservation(raw) {
  const parsed = parseNotes(raw.notes);
  return {
    id: raw.id,
    huariqueId: raw.huariqueId,
    huariqueName: raw.huariqueName ?? '',
    dinerId: raw.dinerId ?? raw.explorerId ?? null,
    dinerName: raw.dinerName ?? raw.explorerName ?? 'Comensal',
    date: raw.date,
    time: String(raw.time).slice(0, 5),
    partySize: Number(raw.partySize),
    status: raw.status,
    zone: raw.zone ?? '',
    code: reservationCode(raw),
    createdAt: raw.createdAt ?? null,
    notes: parsed.notes,
    dishOfInterest: parsed.dishOfInterest,
    liaNote: parsed.liaNote,
  };
}

/** Buckets of the owner's management screen (W8). COMPLETED counts as an approved reservation. */
export const OWNER_TABS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  CLOSED: 'closed',
});

export function ownerTabOf(status) {
  if (status === S.PENDING) return OWNER_TABS.PENDING;
  if (status === S.APPROVED || status === S.COMPLETED) return OWNER_TABS.APPROVED;
  return OWNER_TABS.CLOSED; // REJECTED, EXPIRED
}

/** Counters "del día" for a given date. */
export function dayCounters(reservations, dateString) {
  const today = reservations.filter((r) => r.date === dateString);
  return {
    total: today.length,
    pending: today.filter((r) => r.status === S.PENDING).length,
    approved: today.filter((r) => r.status === S.APPROVED || r.status === S.COMPLETED).length,
    guests: today
      .filter((r) => r.status === S.APPROVED || r.status === S.COMPLETED)
      .reduce((sum, r) => sum + r.partySize, 0),
  };
}

export function sortByDateTime(reservations, direction = 'asc') {
  const sorted = [...reservations].sort(
    (a, b) => reservationDateTime(a).getTime() - reservationDateTime(b).getTime(),
  );
  return direction === 'asc' ? sorted : sorted.reverse();
}
