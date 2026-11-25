/**
 * Verified reviews (UF-W4, US-09, US-10; informe 5.4.2). A review always belongs to a reservation,
 * so every review is "Reserva Verificada". It can only be written when that reservation is
 * APPROVED or COMPLETED and has no review yet.
 */

export const REVIEWABLE_STATUSES = Object.freeze(['APPROVED', 'COMPLETED']);
export const COMMENT_MIN_LENGTH = 20;
export const COMMENT_MAX_LENGTH = 1000;
export const STAR_DISH_MAX_LENGTH = 150;

/**
 * @param {{ id: string, status: string }|null} reservation
 * @param {{ reservationId: string }[]} reviews reviews already known for the huarique
 * @returns {{ allowed: boolean, reason: string }} `reason` is the Spanish explanation when not allowed
 */
export function reviewEligibility(reservation, reviews) {
  if (!reservation) return { allowed: false, reason: 'No encontramos la reserva.' };
  if (reviews.some((review) => review.reservationId === reservation.id)) {
    return { allowed: false, reason: 'Ya reseñaste esta reserva. ¡Gracias por tu opinión!' };
  }
  if (!REVIEWABLE_STATUSES.includes(reservation.status)) {
    return {
      allowed: false,
      reason:
        reservation.status === 'PENDING'
          ? 'Podrás reseñar cuando el huarique apruebe tu reserva.'
          : 'Solo las reservas aprobadas o completadas se pueden reseñar.',
    };
  }
  return { allowed: true, reason: '' };
}

export const canReview = (reservation, reviews) => reviewEligibility(reservation, reviews).allowed;

const isRating = (value) => Number.isInteger(value) && value >= 1 && value <= 5;

export function validateReviewForm(form) {
  const comment = (form.comment ?? '').trim();
  const starDish = (form.starDish ?? '').trim();
  const errors = {
    tasteRating: isRating(form.tasteRating) ? '' : 'Califica el sabor de 1 a 5 estrellas.',
    serviceRating: isRating(form.serviceRating) ? '' : 'Califica la atención de 1 a 5 estrellas.',
    starDish: !starDish
      ? 'Cuéntanos cuál fue tu plato estrella.'
      : starDish.length > STAR_DISH_MAX_LENGTH
        ? `Máximo ${STAR_DISH_MAX_LENGTH} caracteres.`
        : '',
    comment:
      comment.length < COMMENT_MIN_LENGTH
        ? `Escribe al menos ${COMMENT_MIN_LENGTH} caracteres (llevas ${comment.length}).`
        : comment.length > COMMENT_MAX_LENGTH
          ? `Máximo ${COMMENT_MAX_LENGTH} caracteres.`
          : '',
  };
  return { errors, valid: Object.values(errors).every((message) => !message) };
}

/** POST body of /community/huariques/{id}/reviews. */
export function toReviewPayload(form, reservationId) {
  return {
    tasteRating: form.tasteRating,
    serviceRating: form.serviceRating,
    starDish: form.starDish.trim(),
    comment: form.comment.trim(),
    reservationId,
  };
}

export function toReview(raw) {
  return {
    id: raw.id,
    huariqueId: raw.huariqueId,
    reservationId: raw.reservationId,
    authorName: raw.authorName ?? raw.explorerName ?? 'Comensal',
    tasteRating: Number(raw.tasteRating),
    serviceRating: Number(raw.serviceRating),
    starDish: raw.starDish ?? '',
    comment: raw.comment ?? '',
    createdAt: raw.createdAt ?? null,
    // A review cannot exist without a reservation, so it is always verified.
    verified: Boolean(raw.reservationId),
  };
}

/** Average of both ratings per review, and overall. Empty -> zeros. */
export function summarizeReviews(reviews) {
  if (reviews.length === 0) return { count: 0, average: 0, taste: 0, service: 0 };
  const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;
  const taste = mean(reviews.map((r) => r.tasteRating));
  const service = mean(reviews.map((r) => r.serviceRating));
  const round = (value) => Math.round(value * 10) / 10;
  return {
    count: reviews.length,
    average: round(mean(reviews.map((r) => (r.tasteRating + r.serviceRating) / 2))),
    taste: round(taste),
    service: round(service),
  };
}
