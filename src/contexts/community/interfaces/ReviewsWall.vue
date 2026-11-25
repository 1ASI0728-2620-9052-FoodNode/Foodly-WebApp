<script setup>
import { computed, onMounted, watch } from 'vue';
import { useReviewStore } from '../application/useReviewStore.js';
import StarRating from './StarRating.vue';
import AppSkeleton from '../../../shared/ui/AppSkeleton.vue';
import EmptyState from '../../../shared/ui/EmptyState.vue';
import ErrorState from '../../../shared/ui/ErrorState.vue';
import StatusBadge from '../../../shared/ui/StatusBadge.vue';

/** Wall of verified reviews with the average. Used in a huarique's detail and in the owner's reputation. */
const props = defineProps({
  huariqueId: { type: String, required: true },
});

const reviews = useReviewStore();
const list = computed(() => reviews.reviewsOf(props.huariqueId));
const summary = computed(() => reviews.summaryOf(props.huariqueId));
const ready = computed(() => reviews.hasLoaded(props.huariqueId));

const dateFormat = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' });
const formatDate = (iso) =>
  iso && !Number.isNaN(Date.parse(iso)) ? dateFormat.format(new Date(iso)) : '';

const load = () => reviews.load(props.huariqueId);
onMounted(load);
watch(() => props.huariqueId, load);
</script>

<template>
  <div class="wall">
    <div v-if="!ready && reviews.loading" role="status" aria-busy="true">
      <span class="sr-only">Cargando reseñas…</span>
      <AppSkeleton height="96px" />
    </div>
    <ErrorState v-else-if="reviews.error && !ready" :message="reviews.error" @retry="load" />
    <EmptyState
      v-else-if="list.length === 0"
      icon="shieldCheck"
      title="Aún no hay reseñas"
      description="Las reseñas de comensales con reserva verificada aparecerán aquí."
    />
    <template v-else>
      <div class="wall__summary">
        <p class="wall__average">{{ summary.average.toFixed(1) }}</p>
        <div>
          <StarRating :model-value="summary.average" label="Promedio" readonly />
          <p class="wall__count">
            {{ summary.count }}
            {{ summary.count === 1 ? 'reseña verificada' : 'reseñas verificadas' }} · Sabor
            {{ summary.taste.toFixed(1) }} · Atención {{ summary.service.toFixed(1) }}
          </p>
        </div>
      </div>

      <ul class="wall__list">
        <li v-for="review in list" :key="review.id" class="review">
          <div class="review__header">
            <p class="review__author">{{ review.authorName }}</p>
            <StatusBadge v-if="review.verified" status="verified" />
          </div>
          <div class="review__ratings">
            <StarRating :model-value="review.tasteRating" label="Sabor" readonly />
            <StarRating :model-value="review.serviceRating" label="Atención" readonly />
          </div>
          <p class="review__dish"><strong>Plato estrella:</strong> {{ review.starDish }}</p>
          <p class="review__comment">{{ review.comment }}</p>
          <p v-if="formatDate(review.createdAt)" class="review__date">
            {{ formatDate(review.createdAt) }}
          </p>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.wall__summary {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.wall__average {
  font-size: var(--text-3xl);
  font-weight: 800;
  color: var(--color-primary);
}

.wall__count {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.wall__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.review {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.review__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.review__author {
  font-weight: 700;
}

.review__ratings {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  font-size: var(--text-sm);
}

.review__comment {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.review__date {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
</style>
