<script setup>
import { computed, ref } from 'vue';
import { DISTRICTS } from '../../../shared/geo/districts.js';
import { GEO_ERRORS } from '../../../shared/geo/geolocation.js';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppCard from '../../../shared/ui/AppCard.vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';
import AppSelect from '../../../shared/ui/AppSelect.vue';

const props = defineProps({
  location: { type: Object, default: null },
  locating: { type: Boolean, default: false },
  /** One of GEO_ERRORS or '' */
  locationError: { type: String, default: '' },
});

const emit = defineEmits(['share', 'district']);

const districtOptions = [
  { value: '', label: 'Elige un distrito' },
  ...DISTRICTS.map((d) => ({ value: d.id, label: d.name })),
];
const selectedDistrict = ref('');

function onDistrict(value) {
  selectedDistrict.value = value;
  if (value) emit('district', value);
}

const SOURCE_LABELS = {
  gps: 'Usando tu ubicación actual',
  manual: 'Ubicación ajustada en el mapa',
};
const summary = computed(() => {
  if (!props.location) return '';
  return props.location.source === 'district'
    ? `Zona: ${props.location.label}`
    : SOURCE_LABELS[props.location.source];
});

const errorMessage = computed(() => {
  switch (props.locationError) {
    case GEO_ERRORS.DENIED:
      return 'No pudimos acceder a tu ubicación porque el permiso fue denegado. Foodly la necesita solo para buscar los huariques de tu zona y calcular la distancia; no la guardamos. Puedes elegir un distrito o arrastrar el marcador en el mapa hasta donde estás.';
    case GEO_ERRORS.UNSUPPORTED:
      return 'Tu navegador no permite obtener la ubicación. Elige un distrito o arrastra el marcador en el mapa.';
    case GEO_ERRORS.TIMEOUT:
      return 'Tardamos demasiado en obtener tu ubicación. Inténtalo de nuevo, elige un distrito o arrastra el marcador en el mapa.';
    case GEO_ERRORS.UNAVAILABLE:
      return 'No pudimos determinar tu ubicación. Inténtalo de nuevo, elige un distrito o arrastra el marcador en el mapa.';
    default:
      return '';
  }
});
</script>

<template>
  <AppCard class="location-picker">
    <template v-if="!location">
      <h2 class="location-picker__title">Encuentra huariques cerca de ti</h2>
      <p class="location-picker__text">
        Necesitamos tu ubicación para mostrarte los huariques de tu zona y qué tan lejos están.
      </p>
    </template>
    <p v-else class="location-picker__summary">
      <AppIcon name="mapPin" :size="18" />
      {{ summary }}
    </p>

    <div v-if="errorMessage" class="location-picker__alert" role="alert">
      <AppIcon name="info" :size="20" />
      <p>{{ errorMessage }}</p>
    </div>

    <div class="location-picker__actions">
      <AppButton
        :loading="locating"
        :variant="location ? 'secondary' : 'primary'"
        @click="emit('share')"
      >
        <AppIcon name="mapPin" :size="18" />
        {{ location ? 'Actualizar mi ubicación' : 'Compartir Mi Ubicación' }}
      </AppButton>
      <AppSelect
        :model-value="selectedDistrict"
        label="O elige un distrito"
        :options="districtOptions"
        @update:model-value="onDistrict"
      />
    </div>
  </AppCard>
</template>

<style scoped>
.location-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.location-picker__title {
  font-size: var(--text-xl);
}

.location-picker__text {
  color: var(--color-text-muted);
}

.location-picker__summary {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 700;
  color: var(--color-brown);
}

.location-picker__alert {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-pending-soft);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-brown);
}

.location-picker__actions {
  display: grid;
  gap: var(--space-3);
  align-items: end;
}

@media (min-width: 768px) {
  .location-picker__actions {
    grid-template-columns: auto minmax(0, 1fr);
  }
}
</style>
