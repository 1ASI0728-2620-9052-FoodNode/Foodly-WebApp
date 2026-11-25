import { ReviewService } from './ReviewService.js';
import { MockReviewService } from './MockReviewService.js';

export function createReviewService({ mock }) {
  return mock ? new MockReviewService() : new ReviewService();
}
