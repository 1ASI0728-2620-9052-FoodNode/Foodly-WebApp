import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { MockReservationService } from '../infrastructure/MockReservationService.js';
import { ReservationService } from '../infrastructure/ReservationService.js';

// The store talks to whichever adapter the factory builds; tests plug in the real mock adapter.
const { holder } = vi.hoisted(() => ({ holder: { service: null } }));
vi.mock('../infrastructure/reservationServiceFactory.js', () => ({
  createReservationService: () => ({
    create: (...a) => holder.service.create(...a),
    listMine: (...a) => holder.service.listMine(...a),
    listByHuarique: (...a) => holder.service.listByHuarique(...a),
    updateStatus: (...a) => holder.service.updateStatus(...a),
  }),
}));

import { useAuthStore } from '../../iam/application/useAuthStore.js';
import { useReservationStore } from './useReservationStore.js';

const HOURS = [{ day: 'WEDNESDAY', opensAt: '12:00', closesAt: '22:00' }];
const huarique = {
  id: 'h1',
  name: 'Don Pepe',
  address: 'Av. Larco 1, Miraflores',
  location: { latitude: -12.12, longitude: -77.03 },
  openingHours: HOURS,
};
const NOW = new Date(2026, 10, 25, 10, 0); // Wednesday
const form = (patch = {}) => ({
  date: '2026-11-25',
  time: '20:00',
  partySize: 2,
  notes: '',
  dishOfInterest: '',
  ...patch,
});

function signInAs(user) {
  const auth = useAuthStore();
  auth.profile = user;
}

describe('reservation flow with the localStorage mock shared between roles', () => {
  let user = { id: 'explorer-1', name: 'Ana' };
  let store;

  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    holder.service = new MockReservationService({ getUser: () => user, now: () => NOW });
    user = { id: 'explorer-1', name: 'Ana' };
    signInAs(user);
    store = useReservationStore();
  });

  it('creates a PENDING reservation with the contract fields', async () => {
    const result = await store.create({
      huarique,
      form: form({ notes: 'Cumpleaños', dishOfInterest: 'Ceviche' }),
      fromLia: true,
      now: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.reservation).toMatchObject({
      huariqueId: 'h1',
      date: '2026-11-25',
      time: '20:00',
      partySize: 2,
      status: 'PENDING',
      dinerName: 'Ana',
      zone: 'Miraflores',
      dishOfInterest: 'Ceviche',
      liaNote: 'Reserva solicitada desde el chat con Lía.',
      notes: 'Cumpleaños',
    });
    expect(store.mine).toHaveLength(1);
  });

  it('does not call the service when the time is outside the opening hours', async () => {
    const spy = vi.spyOn(holder.service, 'create');
    const result = await store.create({ huarique, form: form({ time: '23:00' }), now: NOW });
    expect(result.ok).toBe(false);
    expect(result.errors.time).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
  });

  it('the owner sees the explorer’s reservation and approves it; the explorer then sees APPROVED', async () => {
    await store.create({ huarique, form: form(), now: NOW });

    // Same browser, now signed in as the owner.
    user = { id: 'owner-1', name: 'Don Pepe' };
    setActivePinia(createPinia());
    signInAs(user);
    const ownerStore = useReservationStore();
    await ownerStore.loadForHuarique('h1');
    expect(ownerStore.forHuarique).toHaveLength(1);
    expect(ownerStore.forHuarique[0]).toMatchObject({ dinerName: 'Ana', status: 'PENDING' });

    const approved = await ownerStore.approve(ownerStore.forHuarique[0].id);
    expect(approved.ok).toBe(true);
    expect(ownerStore.forHuarique[0].status).toBe('APPROVED');

    // Back to the explorer.
    user = { id: 'explorer-1', name: 'Ana' };
    setActivePinia(createPinia());
    signInAs(user);
    const explorerStore = useReservationStore();
    await explorerStore.loadMine();
    expect(explorerStore.mine[0].status).toBe('APPROVED');
  });

  it('an explorer only sees their own reservations', async () => {
    await store.create({ huarique, form: form(), now: NOW });
    user = { id: 'explorer-2', name: 'Luis' };
    setActivePinia(createPinia());
    signInAs(user);
    const other = useReservationStore();
    await other.loadMine();
    expect(other.mine).toEqual([]);
  });

  it('check-in turns an APPROVED reservation into COMPLETED, and a PENDING one cannot check in', async () => {
    const { reservation } = await store.create({ huarique, form: form(), now: NOW });

    const early = await store.checkIn(reservation.id);
    expect(early.ok).toBe(false);
    expect(store.byId(reservation.id).status).toBe('PENDING');

    await store.approve(reservation.id);
    const done = await store.checkIn(reservation.id);
    expect(done.ok).toBe(true);
    expect(store.byId(reservation.id).status).toBe('COMPLETED');
  });

  it('a rejected reservation cannot be approved afterwards', async () => {
    const { reservation } = await store.create({ huarique, form: form(), now: NOW });
    await store.reject(reservation.id);
    const result = await store.approve(reservation.id);
    expect(result.ok).toBe(false);
    expect(store.byId(reservation.id).status).toBe('REJECTED');
  });

  it('the mock refuses an invalid transition even if the store were bypassed (409)', async () => {
    const { reservation } = await store.create({ huarique, form: form(), now: NOW });
    await holder.service.updateStatus(reservation.id, 'REJECTED');
    await expect(holder.service.updateStatus(reservation.id, 'COMPLETED')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('expires a stale PENDING reservation when it is read', async () => {
    const { reservation } = await store.create({
      huarique,
      form: form({ time: '20:00' }),
      now: NOW,
    });
    holder.service = new MockReservationService({
      getUser: () => user,
      now: () => new Date(2026, 10, 25, 21, 0),
    });
    await store.loadMine();
    expect(store.byId(reservation.id).status).toBe('EXPIRED');
  });

  it('survives corrupted storage', async () => {
    localStorage.setItem('foodly.reservation.mock.reservations', '{bad');
    await store.loadMine();
    expect(store.mine).toEqual([]);
  });
});

describe('ReservationService (HTTP, informe 5.5.2)', () => {
  it('uses the documented endpoints and bodies', async () => {
    const raw = {
      id: 'r1',
      huariqueId: 'h1',
      date: '2026-11-25',
      time: '20:00',
      partySize: 2,
      status: 'PENDING',
    };
    const client = {
      post: vi.fn().mockResolvedValue(raw),
      get: vi.fn().mockResolvedValue([raw]),
      put: vi.fn().mockResolvedValue(null),
    };
    const service = new ReservationService(client);

    await service.create({
      huariqueId: 'h1',
      date: '2026-11-25',
      time: '20:00',
      partySize: 2,
      notes: 'x',
      extra: 'ignored',
    });
    expect(client.post).toHaveBeenCalledWith('/reservation-api/reservations', {
      huariqueId: 'h1',
      date: '2026-11-25',
      time: '20:00',
      partySize: 2,
      notes: 'x',
    });

    expect(await service.listMine()).toHaveLength(1);
    expect(client.get).toHaveBeenLastCalledWith('/reservation-api/reservations/me');
    await service.listByHuarique('h1');
    expect(client.get).toHaveBeenLastCalledWith('/reservation-api/reservations/huarique/h1');

    expect(await service.updateStatus('r1', 'APPROVED')).toEqual({ id: 'r1', status: 'APPROVED' });
    expect(client.put).toHaveBeenCalledWith('/reservation-api/reservations/r1/status', {
      status: 'APPROVED',
    });
  });
});
