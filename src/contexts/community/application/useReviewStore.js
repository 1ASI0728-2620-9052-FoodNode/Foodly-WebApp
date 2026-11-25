import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { createReviewService } from '../infrastructure/reviewServiceFactory.js';
import {
  reviewEligibility,
  summarizeReviews,
  toReviewPayload,
  validateReviewForm,
} from '../domain/reviews.js';
import { useAuthStore } from '../../iam/application/useAuthStore.js';
import { MOCK_COMMUNITY } from '../../../shared/config/index.js';

const service = createReviewService({ mock: MOCK_COMMUNITY });

/** Verified reviews of huariques, kept per huarique. */
export const useReviewStore = defineStore('reviews', () => {
  const byHuarique = ref({}); // huariqueId -> Review[]
  const loading = ref(false);
  const error = ref('');

  const reviewsOf = (huariqueId) => byHuarique.value[huariqueId] ?? [];
  const summaryOf = (huariqueId) => summarizeReviews(reviewsOf(huariqueId));
  const hasLoaded = (huariqueId) => huariqueId in byHuarique.value;

  async function load(huariqueId) {
    loading.value = true;
    error.value = '';
    try {
      byHuarique.value = { ...byHuarique.value, [huariqueId]: await service.list(huariqueId) };
    } catch (cause) {
      error.value = cause?.message ?? 'No pudimos cargar las reseñas.';
    } finally {
      loading.value = false;
    }
  }

  /** Eligibility of a reservation given the reviews already loaded for its huarique. */
  const eligibility = computed(
    () => (reservation) => reviewEligibility(reservation, reviewsOf(reservation?.huariqueId)),
  );

  /**
   * Publishes a verified review. Refuses (without calling the service) when the reservation is not
   * APPROVED/COMPLETED, already has a review, or the form is invalid.
   * @returns {Promise<{ ok: boolean, errors?: object, error?: string, review?: object }>}
   */
  async function submit({ reservation, form }) {
    const known = reviewsOf(reservation?.huariqueId);
    const { allowed, reason } = reviewEligibility(reservation, known);
    if (!allowed) return { ok: false, error: reason };

    const validation = validateReviewForm(form);
    if (!validation.valid) return { ok: false, errors: validation.errors };

    try {
      const review = await service.create(
        reservation.huariqueId,
        toReviewPayload(form, reservation.id),
        { authorName: useAuthStore().profile?.name },
      );
      byHuarique.value = {
        ...byHuarique.value,
        [reservation.huariqueId]: [review, ...known],
      };
      return { ok: true, review };
    } catch (cause) {
      return {
        ok: false,
        error:
          cause?.status === 409
            ? 'Ya reseñaste esta reserva.'
            : (cause?.message ?? 'No pudimos publicar tu reseña.'),
      };
    }
  }

  function reset() {
    byHuarique.value = {};
    error.value = '';
  }

  return {
    byHuarique,
    loading,
    error,
    eligibility,
    reviewsOf,
    summaryOf,
    hasLoaded,
    load,
    submit,
    reset,
  };
});
