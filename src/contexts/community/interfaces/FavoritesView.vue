<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useFavoritesStore } from '../application/useFavoritesStore.js';
import { useHuariqueCatalogStore } from '../../business/application/useHuariqueCatalogStore.js';
import { EMPTY_FILTERS, filterHuariques } from '../../business/domain/huariqueFilters.js';
import HuariqueCard from '../../business/interfaces/HuariqueCard.vue';
import FavoriteButton from './FavoriteButton.vue';
import { DISTRICTS } from '../../../shared/geo/districts.js';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppInput from '../../../shared/ui/AppInput.vue';
import AppSelect from '../../../shared/ui/AppSelect.vue';
import AppSkeleton from '../../../shared/ui/AppSkeleton.vue';
import EmptyState from '../../../shared/ui/EmptyState.vue';
import ErrorState from '../../../shared/ui/ErrorState.vue';

const favorites = useFavoritesStore();
const catalog = useHuariqueCatalogStore();

const loadedHuariques = ref(new Map());
const loadingDetails = ref(false);
const failedCount = ref(0);

const text = ref('');
const mode = ref('all'); // 'all' | 'open'
const district = ref('');

const districtOptions = [
  { value: '', label: 'Todos los distritos' },
  ...DISTRICTS.map((d) => ({ value: d.id, label: d.name })),
];

async function loadDetails() {
  const missing = favorites.ids.filter((id) => !loadedHuariques.value.has(id));
  if (missing.length === 0) return;
  loadingDetails.value = true;
  const { huariques, failedIds } = await catalog.loadMany(missing);
  loadedHuariques.value = new Map([...loadedHuariques.value, ...huariques]);
  failedCount.value = failedIds.length;
  loadingDetails.value = false;
}

async function refresh() {
  await favorites.load();
  await loadDetails();
}

// Favorites whose huarique Business no longer has (404) are simply not listed.
const items = computed(() =>
  favorites.ids
    .filter((id) => loadedHuariques.value.has(id))
    .map((id) => ({ huariqueId: id, huarique: loadedHuariques.value.get(id) })),
);

const filtered = computed(() =>
  filterHuariques(items.value, {
    ...EMPTY_FILTERS,
    text: text.value,
    openNow: mode.value === 'open',
    district: district.value,
  }),
);

const busy = computed(() => favorites.loading || loadingDetails.value);

watch(() => favorites.ids, loadDetails);
onMounted(refresh);
</script>

<template>
  <section class="favorites">
    <h1 class="favorites__title">Favoritos</h1>

    <ErrorState
      v-if="favorites.error && !favorites.loaded"
      :message="favorites.error"
      @retry="refresh"
    />

    <template v-else>
      <form class="favorites__filters" role="search" aria-label="Filtrar favoritos" @submit.prevent>
        <AppInput v-model="text" label="Buscar en tus favoritos" type="search" autocomplete="off" />
        <div class="favorites__row">
          <div class="favorites__modes" role="group" aria-label="Mostrar">
            <AppButton
              :variant="mode === 'all' ? 'primary' : 'secondary'"
              :aria-pressed="mode === 'all'"
              @click="mode = 'all'"
            >
              Todos
            </AppButton>
            <AppButton
              :variant="mode === 'open' ? 'primary' : 'secondary'"
              :aria-pressed="mode === 'open'"
              @click="mode = 'open'"
            >
              Abiertos ahora
            </AppButton>
          </div>
          <AppSelect v-model="district" label="Distrito" :options="districtOptions" />
        </div>
      </form>

      <div
        v-if="busy && items.length === 0"
        class="favorites__loading"
        role="status"
        aria-busy="true"
      >
        <span class="sr-only">Cargando tus favoritos…</span>
        <AppSkeleton v-for="n in 3" :key="n" height="120px" />
      </div>

      <EmptyState
        v-else-if="favorites.ids.length === 0"
        icon="heart"
        title="Aún no tienes favoritos"
        description="Toca el corazón de un huarique en el Radar para guardarlo aquí."
      >
        <RouterLink v-slot="{ navigate }" :to="{ name: 'radar' }" custom>
          <AppButton @click="navigate">Ir al Radar</AppButton>
        </RouterLink>
      </EmptyState>

      <EmptyState
        v-else-if="filtered.length === 0"
        icon="info"
        title="Ningún favorito coincide"
        description="Prueba con otra búsqueda o cambia los filtros."
      />

      <ul v-else class="favorites__list">
        <li v-for="item in filtered" :key="item.huariqueId">
          <HuariqueCard :huarique="item.huarique">
            <template #actions>
              <FavoriteButton :huarique-id="item.huariqueId" :huarique-name="item.huarique.name" />
            </template>
          </HuariqueCard>
        </li>
      </ul>

      <p v-if="failedCount > 0" class="favorites__warning" role="status">
        No pudimos cargar {{ failedCount }} {{ failedCount === 1 ? 'favorito' : 'favoritos' }}.
        <button type="button" class="favorites__retry" @click="loadDetails">Reintentar</button>
      </p>
    </template>
  </section>
</template>

<style scoped>
.favorites {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.favorites__title {
  font-size: var(--text-2xl);
}

.favorites__filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.favorites__row {
  display: grid;
  gap: var(--space-3);
  align-items: end;
}

.favorites__modes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

@media (min-width: 768px) {
  .favorites__row {
    grid-template-columns: auto minmax(200px, 280px);
    justify-content: space-between;
  }
}

.favorites__list {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 900px) {
  .favorites__list {
    grid-template-columns: 1fr 1fr;
  }
}

.favorites__loading {
  display: grid;
  gap: var(--space-3);
}

.favorites__warning {
  padding: var(--space-3) var(--space-4);
  background: var(--color-pending-soft);
  border-radius: var(--radius-md);
}

.favorites__retry {
  min-height: var(--touch-target);
  background: none;
  border: 0;
  font-weight: 700;
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
}
</style>
