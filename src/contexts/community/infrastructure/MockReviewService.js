import { HttpError } from '../../../shared/http/HttpError.js';
import { toReview } from '../domain/reviews.js';

const STORAGE_KEY = 'foodly.community.mock.reviews';

const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `review-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** localStorage adapter (VITE_MOCK_COMMUNITY=true), shared by every account in this browser. */
export class MockReviewService {
  constructor({ storage = globalThis.localStorage, now = () => new Date() } = {}) {
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

  async list(huariqueId) {
    return this.#read()
      .filter((r) => r.huariqueId === huariqueId)
      .map(toReview)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async create(huariqueId, payload, context = {}) {
    const all = this.#read();
    // The real service rejects a second review of the same reservation.
    if (all.some((r) => r.reservationId === payload.reservationId)) {
      throw new HttpError({ status: 409, message: 'Ya reseñaste esta reserva.' });
    }
    const raw = {
      id: newId(),
      huariqueId,
      authorName: context.authorName ?? 'Comensal',
      createdAt: this.now().toISOString(),
      ...payload,
    };
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify([...all, raw]));
    } catch {
      /* storage unavailable */
    }
    return toReview(raw);
  }
}
