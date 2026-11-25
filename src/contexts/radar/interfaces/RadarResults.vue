<script setup>
import { RADAR_STATUS } from '../application/useRadarStore.js';
import HuariqueCard from '../../business/interfaces/HuariqueCard.vue';
import FavoriteButton from '../../community/interfaces/FavoriteButton.vue';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppSkeleton from '../../../shared/ui/AppSkeleton.vue';
import EmptyState from '../../../shared/ui/EmptyState.vue';
import ErrorState from '../../../shared/ui/ErrorState.vue';

defineProps({
  status: { type: String, required: true },
  /** Items after client-side filters. */
  items: { type: Array, required: true },
  /** Items before filters, to tell "empty zone" from "filters too strict". */
  totalCount: { type: Number, required: true },
  error: { type: String, default: '' },
  selectedId: { type: String, default: null },
  canWiden: { type: Boolean, default: false },
  incompleteCount: { type: Number, default: 0 },
});

const emit = defineEmits(['retry', 'select', 'reset-filters', 'widen']);
</script>

<template>
  <div class="radar-results">
    <div
      v-if="status === RADAR_STATUS.LOADING"
      class="radar-results__skeletons"
      aria-busy="true"
      role="status"
    >
      <span class="sr-only">Buscando huariques cerca de ti…</span>
      <div v-for="n in 3" :key="n" class="radar-results__skeleton">
        <AppSkeleton width="96px" height="96px" />
        <div class="radar-results__skeleton-text">
          <AppSkeleton width="70%" height="1.25rem" />
          <AppSkeleton width="50%" />
          <AppSkeleton width="35%" height="1.5rem" />
        </div>
      </div>
    </div>

    <ErrorState
      v-else-if="status === RADAR_STATUS.ERROR"
      title="No pudimos buscar huariques"
      :message="error"
      @retry="emit('retry')"
    />

    <template v-else-if="status === RADAR_STATUS.SUCCESS">
      <EmptyState
        v-if="totalCount === 0"
        icon="mapPin"
        title="No hay huariques aquí aún, ¡recomienda uno!"
        description="Todavía no hay huariques activos en esta zona. Prueba con un radio mayor o cambia de zona."
      >
        <AppButton v-if="canWiden" variant="secondary" @click="emit('widen')">
          Ampliar el radio
        </AppButton>
      </EmptyState>

      <EmptyState
        v-else-if="items.length === 0"
        icon="info"
        title="Ningún huarique coincide con tus filtros"
        description="Prueba quitando algún filtro para ver más resultados."
      >
        <AppButton variant="secondary" @click="emit('reset-filters')">Limpiar filtros</AppButton>
      </EmptyState>

      <template v-else>
        <p v-if="incompleteCount > 0" class="radar-results__warning" role="status">
          No pudimos cargar {{ incompleteCount }}
          {{ incompleteCount === 1 ? 'huarique' : 'huariques' }}. La lista puede estar incompleta.
          <button type="button" class="radar-results__link" @click="emit('retry')">
            Reintentar
          </button>
        </p>
        <p class="radar-results__count" aria-live="polite">
          {{ items.length }} {{ items.length === 1 ? 'huarique' : 'huariques' }} cerca de ti
        </p>
        <ul class="radar-results__list">
          <li v-for="item in items" :key="item.huariqueId">
            <HuariqueCard
              :huarique="item.huarique"
              :distance-meters="item.distanceMeters"
              :selected="item.huariqueId === selectedId"
              @select="emit('select', item.huariqueId)"
            >
              <template #actions>
                <FavoriteButton
                  :huarique-id="item.huariqueId"
                  :huarique-name="item.huarique.name"
                />
              </template>
            </HuariqueCard>
          </li>
        </ul>
      </template>
    </template>
  </div>
</template>

<style scoped>
.radar-results__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.radar-results__count {
  margin-bottom: var(--space-3);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-muted);
}

.radar-results__warning {
  margin-bottom: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-pending-soft);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.radar-results__link {
  min-height: var(--touch-target);
  padding: 0 var(--space-2);
  background: none;
  border: 0;
  font-weight: 700;
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
}

.radar-results__skeletons {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.radar-results__skeleton {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3);
  background: var(--color-white);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.radar-results__skeleton-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-3);
}
</style>
