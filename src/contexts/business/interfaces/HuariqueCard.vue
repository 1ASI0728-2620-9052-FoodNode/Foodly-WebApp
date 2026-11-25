<script setup>
import { CUISINE_TYPES } from '../domain/huarique.js';
import { formatDistance, formatPriceRange } from '../../../shared/utils/format.js';
import AppIcon from '../../../shared/ui/AppIcon.vue';
import StatusBadge from '../../../shared/ui/StatusBadge.vue';

const props = defineProps({
  /** Normalized huarique (see business/domain/huarique.js). */
  huarique: { type: Object, required: true },
  distanceMeters: { type: Number, default: null },
  selected: { type: Boolean, default: false },
});

const emit = defineEmits(['select']);

const photo = props.huarique.images[0]?.url ?? null;
</script>

<template>
  <article
    :id="`huarique-${huarique.id}`"
    class="huarique-card"
    :class="{ 'huarique-card--selected': selected }"
    :aria-current="selected ? 'true' : undefined"
    @click="emit('select', huarique.id)"
  >
    <div class="huarique-card__photo">
      <img v-if="photo" :src="photo" :alt="`Foto de ${huarique.name}`" loading="lazy" />
      <span v-else class="huarique-card__placeholder"><AppIcon name="utensils" :size="32" /></span>
    </div>

    <div class="huarique-card__body">
      <div class="huarique-card__heading">
        <h3 class="huarique-card__title">
          <RouterLink :to="{ name: 'huarique-detail', params: { id: huarique.id } }">
            {{ huarique.name }}
          </RouterLink>
        </h3>
        <slot name="actions" />
      </div>

      <p class="huarique-card__meta">
        {{ CUISINE_TYPES[huarique.cuisineType] ?? huarique.cuisineType }} ·
        {{ formatPriceRange(huarique.priceMin, huarique.priceMax) }}
      </p>

      <div class="huarique-card__footer">
        <StatusBadge :status="huarique.isOpen ? 'open' : 'closed'" />
        <span v-if="distanceMeters !== null" class="huarique-card__distance">
          <AppIcon name="mapPin" :size="16" />
          {{ formatDistance(distanceMeters) }}
        </span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.huarique-card {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3);
  background: var(--color-white);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.huarique-card:hover {
  box-shadow: var(--shadow-md);
}

.huarique-card--selected {
  border-color: var(--color-pending);
  box-shadow: var(--shadow-md);
}

.huarique-card__photo {
  flex: none;
  width: 96px;
  height: 96px;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface-soft);
}

.huarique-card__photo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.huarique-card__placeholder {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  color: var(--color-primary);
}

.huarique-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.huarique-card__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.huarique-card__title {
  font-size: var(--text-lg);
  overflow-wrap: anywhere;
}

.huarique-card__title a {
  color: inherit;
  text-decoration: none;
}

.huarique-card__title a:hover {
  text-decoration: underline;
}

.huarique-card__meta {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.huarique-card__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  margin-top: auto;
}

.huarique-card__distance {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-brown);
}
</style>
