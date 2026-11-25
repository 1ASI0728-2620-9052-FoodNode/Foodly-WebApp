<script setup>
import { computed, nextTick, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import {
  K_RING_MAX,
  K_RING_MIN,
  RADAR_STATUS,
  useRadarStore,
} from '../application/useRadarStore.js';
import { useFavoritesStore } from '../../community/application/useFavoritesStore.js';
import LocationPicker from './LocationPicker.vue';
import RadarResults from './RadarResults.vue';
import HuariqueFilters from '../../business/interfaces/HuariqueFilters.vue';
import { DISTRICTS } from '../../../shared/geo/districts.js';
import AppMap from '../../../shared/ui/AppMap.vue';
import AppSelect from '../../../shared/ui/AppSelect.vue';

const radar = useRadarStore();
const favorites = useFavoritesStore();
const {
  location,
  kRing,
  status,
  items,
  filteredItems,
  filters,
  error,
  locationError,
  permissionDenied,
  coverage,
  searchMs,
  searchCount,
  selectedId,
  incompleteCount,
} = storeToRefs(radar);

const IS_DEV = import.meta.env.DEV;
const RNF01_LIMIT_MS = 2000;

const radiusOptions = Array.from({ length: K_RING_MAX - K_RING_MIN + 1 }, (_, index) => {
  const k = K_RING_MIN + index;
  return {
    value: String(k),
    label: `${k} ${k === 1 ? 'anillo' : 'anillos'} (~${300 * k + 150} m)`,
  };
});

// With no location yet, a denied permission still shows a draggable marker over this default zone.
const FALLBACK_CENTER = DISTRICTS[0];
const showMap = computed(() => Boolean(location.value) || permissionDenied.value);
const mapCenter = computed(() => location.value ?? FALLBACK_CENTER);

const markers = computed(() => {
  const list = [
    {
      id: 'user',
      kind: 'user',
      label: 'Tu ubicación. Arrástrame para ajustarla.',
      latitude: mapCenter.value.latitude,
      longitude: mapCenter.value.longitude,
      draggable: true,
    },
  ];
  for (const item of filteredItems.value) {
    list.push({
      id: item.huariqueId,
      kind: 'huarique',
      label: item.huarique.name,
      latitude: item.latitude,
      longitude: item.longitude,
      selected: item.huariqueId === selectedId.value,
    });
  }
  return list;
});

const polygons = computed(() =>
  (coverage.value?.polygons ?? []).map((cell) => ({
    id: cell.id,
    latLngs: cell.latLngs,
    highlight: cell.isOrigin,
  })),
);

const timingOk = computed(() => searchMs.value !== null && searchMs.value <= RNF01_LIMIT_MS);

function onMarkerClick(id) {
  if (id !== 'user') radar.select(id);
}

function onMarkerDrag({ id, latitude, longitude }) {
  if (id === 'user') radar.setManualLocation({ latitude, longitude });
}

watch(selectedId, async (id) => {
  if (!id) return;
  await nextTick();
  document
    .getElementById(`huarique-${id}`)
    ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

onMounted(() => {
  if (!favorites.loaded) favorites.load();
});
</script>

<template>
  <section class="radar">
    <header class="radar__header">
      <h1 class="radar__title">Radar H3</h1>
      <div v-if="location" class="radar__radius">
        <AppSelect
          :model-value="String(kRing)"
          label="Radio de búsqueda"
          :options="radiusOptions"
          @update:model-value="radar.setKRing($event)"
        />
      </div>
    </header>

    <LocationPicker
      :location="location"
      :locating="status === RADAR_STATUS.LOCATING"
      :location-error="locationError"
      @share="radar.shareLocation()"
      @district="radar.chooseDistrict($event)"
    />

    <div v-if="showMap" class="radar__layout">
      <div class="radar__map">
        <AppMap
          :center="mapCenter"
          :zoom="15"
          :markers="markers"
          :polygons="polygons"
          :fit-token="searchCount"
          aria-label="Mapa del Radar H3 con tu ubicación y los huariques cercanos"
          @marker-click="onMarkerClick"
          @marker-drag="onMarkerDrag"
        />
        <p class="radar__hint">Arrastra el marcador azul para ajustar tu ubicación.</p>
      </div>

      <div v-if="location" class="radar__list">
        <p
          v-if="IS_DEV && searchMs !== null"
          class="radar__timing"
          :class="{ 'radar__timing--slow': !timingOk }"
          data-testid="search-timing"
        >
          Búsqueda (Radar + Business): {{ searchMs }} ms · RNF-01 máx. {{ RNF01_LIMIT_MS }} ms ·
          {{ timingOk ? 'cumple' : 'NO cumple' }}
        </p>
        <HuariqueFilters v-model="filters" />
        <RadarResults
          :status="status"
          :items="filteredItems"
          :total-count="items.length"
          :error="error"
          :selected-id="selectedId"
          :can-widen="kRing < K_RING_MAX"
          :incomplete-count="incompleteCount"
          @retry="radar.search()"
          @select="radar.select($event)"
          @reset-filters="radar.resetFilters()"
          @widen="radar.setKRing(kRing + 1)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.radar {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.radar__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
}

.radar__title {
  font-size: var(--text-2xl);
}

.radar__radius {
  min-width: 220px;
}

/* Mobile first: map on top, cards below. */
.radar__layout {
  display: grid;
  gap: var(--space-5);
}

.radar__map {
  height: 320px;
}

.radar__hint {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.radar__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.radar__timing {
  padding: var(--space-2) var(--space-3);
  background: var(--color-success-soft);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--color-success-dark);
}

.radar__timing--slow {
  background: var(--color-error-soft);
  color: var(--color-error);
}

@media (min-width: 768px) {
  .radar__layout {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    align-items: start;
  }

  .radar__map {
    position: sticky;
    top: calc(var(--topbar-height) + var(--space-4));
    height: calc(100vh - var(--topbar-height) - var(--space-7));
    min-height: 420px;
  }
}
</style>
