import { ReservationService } from './ReservationService.js';
import { MockReservationService } from './MockReservationService.js';

/** Mock (localStorage) while Reservation has no API, HTTP otherwise. */
export function createReservationService({ mock, getUser }) {
  return mock ? new MockReservationService({ getUser }) : new ReservationService();
}
