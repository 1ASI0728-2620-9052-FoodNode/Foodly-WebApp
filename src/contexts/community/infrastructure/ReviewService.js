import { httpClient as defaultClient } from '../../../shared/http/index.js';
import { toReview } from '../domain/reviews.js';

/**
 * HTTP adapter for reviews (informe 5.4.2, through Kong /community).
 * Same interface as MockReviewService: list(huariqueId), create(huariqueId, payload, context).
 */
export class ReviewService {
  constructor(client = defaultClient) {
    this.client = client;
  }

  /** GET /community/huariques/{id}/reviews */
  async list(huariqueId) {
    const data = await this.client.get(
      `/community/huariques/${encodeURIComponent(huariqueId)}/reviews`,
    );
    return (data ?? []).map(toReview);
  }

  /** POST /community/huariques/{id}/reviews { tasteRating, serviceRating, starDish, comment, reservationId } */
  async create(huariqueId, payload) {
    return toReview(
      await this.client.post(
        `/community/huariques/${encodeURIComponent(huariqueId)}/reviews`,
        payload,
      ),
    );
  }
}
