<script setup>
import { computed, reactive, ref } from 'vue';
import { useReviewStore } from '../application/useReviewStore.js';
import { COMMENT_MIN_LENGTH } from '../domain/reviews.js';
import StarRating from './StarRating.vue';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';
import AppInput from '../../../shared/ui/AppInput.vue';
import StatusBadge from '../../../shared/ui/StatusBadge.vue';
import { useToast } from '../../../shared/ui/useToast.js';

/**
 * Verified review form. It is only enabled when the reservation is APPROVED or COMPLETED and has
 * no review yet; otherwise it explains why not.
 */
const props = defineProps({
  reservation: { type: Object, required: true },
});

const emit = defineEmits(['submitted']);

const reviews = useReviewStore();
const toast = useToast();

const form = reactive({ tasteRating: 0, serviceRating: 0, starDish: '', comment: '' });
const errors = ref({});
const submitError = ref('');
const submitting = ref(false);

const eligibility = computed(() => reviews.eligibility(props.reservation));

async function submit() {
  submitError.value = '';
  submitting.value = true;
  const result = await reviews.submit({ reservation: props.reservation, form });
  submitting.value = false;
  errors.value = result.errors ?? {};
  if (result.ok) {
    toast.success('¡Gracias! Tu reseña verificada ya está publicada.');
    emit('submitted', result.review);
  } else if (result.error) {
    submitError.value = result.error;
  }
}
</script>

<template>
  <section class="review-form" aria-labelledby="review-title">
    <div class="review-form__header">
      <h2 id="review-title">Califica tu experiencia</h2>
      <StatusBadge status="verified" />
    </div>

    <p v-if="!eligibility.allowed" class="review-form__blocked" role="status">
      <AppIcon name="info" :size="20" /> {{ eligibility.reason }}
    </p>

    <form v-else class="review-form__fields" novalidate @submit.prevent="submit">
      <StarRating v-model="form.tasteRating" label="Sabor" :error="errors.tasteRating" />
      <StarRating v-model="form.serviceRating" label="Atención" :error="errors.serviceRating" />
      <AppInput
        v-model="form.starDish"
        label="Plato estrella"
        maxlength="150"
        :error="errors.starDish"
      />

      <div class="review-form__comment">
        <label for="review-comment">Tu comentario</label>
        <textarea
          id="review-comment"
          v-model="form.comment"
          rows="4"
          maxlength="1000"
          :aria-invalid="errors.comment ? 'true' : undefined"
          aria-describedby="review-comment-hint"
        />
        <p
          id="review-comment-hint"
          class="review-form__hint"
          :class="{ 'review-form__hint--error': errors.comment }"
        >
          {{
            errors.comment ||
            `Mínimo ${COMMENT_MIN_LENGTH} caracteres (${form.comment.trim().length}).`
          }}
        </p>
      </div>

      <p v-if="submitError" class="review-form__error" role="alert">{{ submitError }}</p>
      <AppButton type="submit" :loading="submitting">Publicar reseña verificada</AppButton>
    </form>
  </section>
</template>

<style scoped>
.review-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.review-form__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.review-form__header h2 {
  font-size: var(--text-xl);
}

.review-form__blocked {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-soft);
  border-radius: var(--radius-md);
  color: var(--color-brown);
}

.review-form__fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.review-form__comment {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.review-form__comment label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-brown);
}

.review-form__comment textarea {
  padding: var(--space-3) var(--space-4);
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  resize: vertical;
}

.review-form__comment textarea:focus-visible {
  outline: none;
  border-color: var(--color-focus);
  box-shadow: var(--focus-ring);
}

.review-form__hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.review-form__hint--error,
.review-form__error {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-error);
}
</style>
