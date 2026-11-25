import { describe, expect, it } from 'vitest';
import {
  canReview,
  reviewEligibility,
  summarizeReviews,
  toReview,
  toReviewPayload,
  validateReviewForm,
} from './reviews.js';

const reservation = (status, id = 'r1') => ({ id, huariqueId: 'h1', status });
const goodForm = () => ({
  tasteRating: 5,
  serviceRating: 4,
  starDish: 'Ceviche clásico',
  comment: 'Excelente atención y el ceviche estaba fresquísimo.',
});

describe('verified review eligibility (US-09, US-10)', () => {
  it('is enabled for APPROVED and COMPLETED reservations without a review', () => {
    expect(canReview(reservation('APPROVED'), [])).toBe(true);
    expect(canReview(reservation('COMPLETED'), [])).toBe(true);
  });

  it.each(['PENDING', 'REJECTED', 'EXPIRED'])('is disabled for a %s reservation', (status) => {
    const result = reviewEligibility(reservation(status), []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('explains that a PENDING reservation must be approved first', () => {
    expect(reviewEligibility(reservation('PENDING'), []).reason).toMatch(/apruebe tu reserva/);
  });

  it('is disabled when that reservation already has a review', () => {
    const result = reviewEligibility(reservation('COMPLETED'), [{ reservationId: 'r1' }]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/Ya reseñaste/);
  });

  it('a review of another reservation does not block this one', () => {
    expect(canReview(reservation('APPROVED', 'r2'), [{ reservationId: 'r1' }])).toBe(true);
  });

  it('is disabled without a reservation', () => {
    expect(canReview(null, [])).toBe(false);
  });
});

describe('review form validation', () => {
  it('accepts a complete review', () => {
    expect(validateReviewForm(goodForm()).valid).toBe(true);
  });

  it('requires ratings from 1 to 5 (integers)', () => {
    for (const rating of [0, 6, 2.5, undefined, null]) {
      expect(
        validateReviewForm({ ...goodForm(), tasteRating: rating }).errors.tasteRating,
      ).toBeTruthy();
      expect(
        validateReviewForm({ ...goodForm(), serviceRating: rating }).errors.serviceRating,
      ).toBeTruthy();
    }
    expect(validateReviewForm({ ...goodForm(), tasteRating: 1, serviceRating: 5 }).valid).toBe(
      true,
    );
  });

  it('requires a comment of at least 20 characters (after trimming)', () => {
    expect(
      validateReviewForm({ ...goodForm(), comment: 'a'.repeat(19) }).errors.comment,
    ).toBeTruthy();
    expect(validateReviewForm({ ...goodForm(), comment: 'a'.repeat(20) }).valid).toBe(true);
    expect(validateReviewForm({ ...goodForm(), comment: `  ${'a'.repeat(19)}  ` }).valid).toBe(
      false,
    );
  });

  it('requires the star dish', () => {
    expect(validateReviewForm({ ...goodForm(), starDish: '  ' }).errors.starDish).toBeTruthy();
  });

  it('builds the POST body with the reservation id', () => {
    expect(toReviewPayload({ ...goodForm(), starDish: ' Ceviche ' }, 'r1')).toEqual({
      tasteRating: 5,
      serviceRating: 4,
      starDish: 'Ceviche',
      comment: 'Excelente atención y el ceviche estaba fresquísimo.',
      reservationId: 'r1',
    });
  });
});

describe('verified label and reputation', () => {
  it('every review that belongs to a reservation is "Reserva Verificada"', () => {
    expect(
      toReview({ id: '1', reservationId: 'r1', tasteRating: 5, serviceRating: 5 }).verified,
    ).toBe(true);
    expect(toReview({ id: '2', tasteRating: 5, serviceRating: 5 }).verified).toBe(false);
  });

  it('averages the ratings', () => {
    const reviews = [
      { tasteRating: 5, serviceRating: 4 },
      { tasteRating: 3, serviceRating: 4 },
    ];
    expect(summarizeReviews(reviews)).toEqual({ count: 2, average: 4, taste: 4, service: 4 });
    expect(summarizeReviews([{ tasteRating: 5, serviceRating: 4 }]).average).toBe(4.5);
  });

  it('an empty wall has zeros, not NaN', () => {
    expect(summarizeReviews([])).toEqual({ count: 0, average: 0, taste: 0, service: 0 });
  });
});
