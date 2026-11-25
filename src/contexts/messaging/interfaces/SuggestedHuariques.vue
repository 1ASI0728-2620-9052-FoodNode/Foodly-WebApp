<script setup>
import { CUISINE_TYPES } from '../../business/domain/huarique.js';
import { formatPriceRange } from '../../../shared/utils/format.js';
import AppIcon from '../../../shared/ui/AppIcon.vue';
import StatusBadge from '../../../shared/ui/StatusBadge.vue';

/** Mini cards for the huariques Lía mentions; each opens the detail. */
defineProps({
  /** [{ huariqueId, huarique, distanceText }] */
  items: { type: Array, required: true },
});
</script>

<template>
  <ul class="suggested" aria-label="Huariques sugeridos por Lía">
    <li v-for="item in items" :key="item.huariqueId">
      <RouterLink
        class="mini-card"
        :to="{ name: 'huarique-detail', params: { id: item.huariqueId } }"
      >
        <span class="mini-card__icon"><AppIcon name="utensils" :size="20" /></span>
        <span class="mini-card__body">
          <span class="mini-card__name">{{ item.huarique.name }}</span>
          <span class="mini-card__meta">
            {{ CUISINE_TYPES[item.huarique.cuisineType] ?? item.huarique.cuisineType }} ·
            {{ formatPriceRange(item.huarique.priceMin, item.huarique.priceMax) }}
            <template v-if="item.distanceText"> · a {{ item.distanceText }}</template>
          </span>
          <StatusBadge :status="item.huarique.isOpen ? 'open' : 'closed'" />
        </span>
      </RouterLink>
    </li>
  </ul>
</template>

<style scoped>
.suggested {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
}

.mini-card {
  display: flex;
  gap: var(--space-3);
  min-height: var(--touch-target);
  padding: var(--space-3);
  background: var(--color-white);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  color: inherit;
  text-decoration: none;
}

.mini-card:hover {
  border-color: var(--color-primary);
}

.mini-card__icon {
  display: inline-flex;
  align-self: flex-start;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-surface-soft);
  color: var(--color-primary);
}

.mini-card__body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  min-width: 0;
}

.mini-card__name {
  font-weight: 700;
  color: var(--color-brown);
}

.mini-card__meta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
</style>
