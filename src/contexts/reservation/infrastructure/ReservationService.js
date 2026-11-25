import { httpClient as defaultClient } from '../../../shared/http/index.js';
import { toReservation } from '../domain/reservation.js';

const BASE = '/reservation-api/reservations';

/**
 * HTTP adapter for Foodly-Reservation-Service (informe 5.5.2, through Kong /reservation-api).
 * Same interface as MockReservationService:
 *   create(payload, context), listMine(), listByHuarique(id), updateStatus(id, status)
 * `context` (diner and huarique names) only matters to the mock; the real service knows them.
 */
export class ReservationService {
  constructor(client = defaultClient) {
    this.client = client;
  }

  /** POST /reservation-api/reservations { huariqueId, date, time, partySize, notes } */
  async create({ huariqueId, date, time, partySize, notes }) {
    return toReservation(
      await this.client.post(BASE, { huariqueId, date, time, partySize, notes }),
    );
  }

  /** GET /reservation-api/reservations/me */
  async listMine() {
    return ((await this.client.get(`${BASE}/me`)) ?? []).map(toReservation);
  }

  /** GET /reservation-api/reservations/huarique/{huariqueId} */
  async listByHuarique(huariqueId) {
    return (
      (await this.client.get(`${BASE}/huarique/${encodeURIComponent(huariqueId)}`)) ?? []
    ).map(toReservation);
  }

  /** PUT /reservation-api/reservations/{id}/status { status } */
  async updateStatus(id, status) {
    const data = await this.client.put(`${BASE}/${encodeURIComponent(id)}/status`, { status });
    return data ? toReservation(data) : { id, status };
  }
}
