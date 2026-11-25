import { HttpError } from '../../../shared/http/HttpError.js';
import {
  RESERVATION_STATUS,
  canTransition,
  expireIfStale,
  toReservation,
} from '../domain/reservation.js';

const STORAGE_KEY = 'foodly.reservation.mock.reservations';

const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `00000000-0000-4000-8000-${String(Date.now()).padStart(12, '0').slice(-12)}`;

/**
 * localStorage adapter (VITE_MOCK_RESERVATION=true). The store is ONE list shared by every account
 * in this browser, so an explorer can request a table and, in another tab or after switching
 * accounts, the owner approves it: the full flow can be demonstrated without a backend.
 * Same interface as ReservationService.
 */
export class MockReservationService {
  /**
   * @param {{ getUser: () => { id: string, name?: string }|null, storage?: Storage, now?: () => Date }} options
   */
  constructor({ getUser, storage = globalThis.localStorage, now = () => new Date() }) {
    this.getUser = getUser;
    this.storage = storage;
    this.now = now;
  }

  #read() {
    try {
      const parsed = JSON.parse(this.storage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  #write(list) {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* storage unavailable: nothing persists */
    }
  }

  /** Reads the list and expires stale PENDING reservations, persisting the change. */
  #load() {
    const list = this.#read();
    const expired = list.map((r) => expireIfStale(r, this.now()));
    if (expired.some((r, i) => r.status !== list[i].status)) this.#write(expired);
    return expired;
  }

  async create({ huariqueId, date, time, partySize, notes }, context = {}) {
    const user = this.getUser();
    const raw = {
      id: newId(),
      huariqueId,
      huariqueName: context.huariqueName ?? '',
      zone: context.zone ?? '',
      dinerId: user?.id ?? null,
      dinerName: context.dinerName ?? user?.name ?? 'Comensal',
      date,
      time,
      partySize: Number(partySize),
      notes: notes ?? '',
      status: RESERVATION_STATUS.PENDING,
      createdAt: this.now().toISOString(),
    };
    this.#write([...this.#read(), raw]);
    return toReservation(raw);
  }

  async listMine() {
    const userId = this.getUser()?.id;
    return this.#load()
      .filter((r) => r.dinerId === userId)
      .map(toReservation);
  }

  async listByHuarique(huariqueId) {
    return this.#load()
      .filter((r) => r.huariqueId === huariqueId)
      .map(toReservation);
  }

  async updateStatus(id, status) {
    const list = this.#load();
    const current = list.find((r) => r.id === id);
    if (!current) throw new HttpError({ status: 404, message: 'No encontramos la reserva.' });
    if (!canTransition(current.status, status)) {
      throw new HttpError({
        status: 409,
        message: 'La reserva ya cambió de estado. Actualiza la lista para ver su estado actual.',
      });
    }
    const updated = { ...current, status };
    this.#write(list.map((r) => (r.id === id ? updated : r)));
    return toReservation(updated);
  }
}
