import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { searchNearby } from './searchNearby.js';
import { EMPTY_FILTERS, filterHuariques } from '../../business/domain/huariqueFilters.js';
import { buildCoverage } from '../../../shared/geo/h3Zone.js';
import { findDistrict } from '../../../shared/geo/districts.js';
import { GEO_ERRORS, getCurrentLocation } from '../../../shared/geo/geolocation.js';

export const K_RING_MIN = 1;
export const K_RING_MAX = 5;
export const K_RING_DEFAULT = 2;

export const RADAR_STATUS = Object.freeze({
  IDLE: 'idle',
  LOCATING: 'locating',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
});

function clampKRing(value) {
  const number = Math.trunc(Number(value));
  if (Number.isNaN(number)) return K_RING_DEFAULT;
  return Math.min(K_RING_MAX, Math.max(K_RING_MIN, number));
}

/**
 * Radar H3 (W2). A search = POST /radar/search + completing every result from Business.
 * `searchMs` measures that whole path (RNF-01: at most 2 s); the view shows it in dev builds.
 */
export const useRadarStore = defineStore('radar', () => {
  const location = ref(null); // { latitude, longitude, source: 'gps' | 'district' | 'manual', label? }
  const kRing = ref(K_RING_DEFAULT);
  const status = ref(RADAR_STATUS.IDLE);
  const items = ref([]);
  const error = ref('');
  const locationError = ref(''); // 'denied' | 'unavailable' | ...
  const searchMs = ref(null);
  const incompleteCount = ref(0);
  const selectedId = ref(null);
  const filters = ref({ ...EMPTY_FILTERS });
  const searchCount = ref(0); // used as map `fitToken`
  let searchSeq = 0;

  const permissionDenied = computed(() => locationError.value === GEO_ERRORS.DENIED);
  const coverage = computed(() =>
    location.value ? buildCoverage(location.value, kRing.value) : null,
  );
  const filteredItems = computed(() => filterHuariques(items.value, filters.value));
  const isEmpty = computed(() => status.value === RADAR_STATUS.SUCCESS && items.value.length === 0);

  async function search() {
    if (!location.value) return;
    const seq = ++searchSeq;
    status.value = RADAR_STATUS.LOADING;
    error.value = '';
    const startedAt = performance.now();
    try {
      const { locations, ...result } = await searchNearby({
        latitude: location.value.latitude,
        longitude: location.value.longitude,
        kRing: kRing.value,
      });
      if (seq !== searchSeq) return; // a newer search superseded this one

      if (locations.length > 0 && result.items.length === 0 && result.failedCount > 0) {
        throw new Error('Business lookup failed for every result');
      }
      items.value = result.items;
      incompleteCount.value = result.failedCount;
      searchMs.value = Math.round(performance.now() - startedAt);
      selectedId.value = null;
      searchCount.value += 1;
      status.value = RADAR_STATUS.SUCCESS;
    } catch (cause) {
      if (seq !== searchSeq) return;
      items.value = [];
      error.value =
        cause?.status === 403
          ? 'Solo los exploradores pueden usar el Radar.'
          : cause?.message && cause.status !== undefined
            ? cause.message
            : 'No pudimos buscar huariques cerca de ti. Inténtalo de nuevo.';
      status.value = RADAR_STATUS.ERROR;
    }
  }

  /** "Compartir Mi Ubicación": asks the browser; on refusal keeps the reason for the UI. */
  async function shareLocation() {
    status.value = RADAR_STATUS.LOCATING;
    locationError.value = '';
    try {
      const position = await getCurrentLocation();
      location.value = { ...position, source: 'gps' };
    } catch (cause) {
      locationError.value = cause?.code ?? GEO_ERRORS.UNAVAILABLE;
      status.value = RADAR_STATUS.IDLE;
      return false;
    }
    await search();
    return true;
  }

  async function chooseDistrict(districtId) {
    const district = findDistrict(districtId);
    if (!district) return;
    locationError.value = '';
    location.value = {
      latitude: district.latitude,
      longitude: district.longitude,
      source: 'district',
      label: district.name,
    };
    await search();
  }

  /** Marker dragged on the map. */
  async function setManualLocation({ latitude, longitude }) {
    location.value = { latitude, longitude, source: 'manual' };
    await search();
  }

  async function setKRing(value) {
    kRing.value = clampKRing(value);
    await search();
  }

  function select(id) {
    selectedId.value = id;
  }

  function setFilters(next) {
    filters.value = { ...filters.value, ...next };
  }

  function resetFilters() {
    filters.value = { ...EMPTY_FILTERS };
  }

  function reset() {
    searchSeq += 1; // discards any search still in flight
    location.value = null;
    kRing.value = K_RING_DEFAULT;
    status.value = RADAR_STATUS.IDLE;
    items.value = [];
    error.value = '';
    locationError.value = '';
    searchMs.value = null;
    incompleteCount.value = 0;
    selectedId.value = null;
    filters.value = { ...EMPTY_FILTERS };
  }

  return {
    location,
    kRing,
    status,
    items,
    error,
    locationError,
    searchMs,
    incompleteCount,
    selectedId,
    filters,
    searchCount,
    permissionDenied,
    coverage,
    filteredItems,
    isEmpty,
    search,
    shareLocation,
    chooseDistrict,
    setManualLocation,
    setKRing,
    select,
    setFilters,
    resetFilters,
    reset,
  };
});
