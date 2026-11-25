<script setup>
import { computed, ref } from 'vue';
import { LIMITS } from '../domain/huariqueForm.js';
import { DISTRICTS } from '../../../shared/geo/districts.js';
import { GEO_ERRORS, getCurrentLocation } from '../../../shared/geo/geolocation.js';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';
import AppInput from '../../../shared/ui/AppInput.vue';
import AppMap from '../../../shared/ui/AppMap.vue';

/** Price range in S/, address and a Leaflet map where the owner drops the pin. */
const props = defineProps({
  form: { type: Object, required: true },
  errors: { type: Object, default: () => ({}) },
});

const locating = ref(false);
const geoMessage = ref('');

const hasPin = computed(
  () => Number.isFinite(props.form.latitude) && Number.isFinite(props.form.longitude),
);
const center = computed(() =>
  hasPin.value ? { latitude: props.form.latitude, longitude: props.form.longitude } : DISTRICTS[0],
);
const markers = computed(() =>
  hasPin.value
    ? [
        {
          id: 'pin',
          kind: 'huarique',
          label: 'Ubicación de tu huarique. Arrástrame para ajustarla.',
          latitude: props.form.latitude,
          longitude: props.form.longitude,
          draggable: true,
        },
      ]
    : [],
);

function setPin({ latitude, longitude }) {
  props.form.latitude = Number(latitude.toFixed(6));
  props.form.longitude = Number(longitude.toFixed(6));
}

async function useMyLocation() {
  locating.value = true;
  geoMessage.value = '';
  try {
    setPin(await getCurrentLocation());
  } catch (cause) {
    geoMessage.value =
      cause?.code === GEO_ERRORS.DENIED
        ? 'No tenemos permiso para ver tu ubicación. Toca el mapa para marcar dónde está tu huarique.'
        : 'No pudimos obtener tu ubicación. Toca el mapa para marcarla.';
  } finally {
    locating.value = false;
  }
}
</script>

<template>
  <div class="fields">
    <div class="fields__prices">
      <AppInput
        v-model="form.priceMin"
        label="Precio mínimo (S/)"
        inputmode="decimal"
        hint="Lo menos que gasta un comensal."
        :error="errors.priceMin"
      />
      <AppInput
        v-model="form.priceMax"
        label="Precio máximo (S/)"
        inputmode="decimal"
        hint="Lo más que gasta un comensal."
        :error="errors.priceMax"
      />
    </div>

    <AppInput
      v-model="form.address"
      label="Dirección"
      :maxlength="LIMITS.ADDRESS"
      autocomplete="street-address"
      :error="errors.address"
    />

    <div class="fields__map-block">
      <div class="fields__map-header">
        <p class="fields__map-title">Ubicación en el mapa</p>
        <AppButton variant="secondary" :loading="locating" @click="useMyLocation">
          <AppIcon name="mapPin" :size="18" /> Usar mi ubicación actual
        </AppButton>
      </div>
      <p class="fields__map-hint">Toca el mapa para poner el pin y arrástralo para ajustarlo.</p>
      <p v-if="geoMessage" class="fields__geo" role="status">{{ geoMessage }}</p>
      <div class="fields__map">
        <AppMap
          :center="center"
          :zoom="hasPin ? 17 : 14"
          :markers="markers"
          clickable
          aria-label="Mapa para ubicar tu huarique"
          @map-click="setPin"
          @marker-drag="setPin"
        />
      </div>
      <p v-if="hasPin" class="fields__coords">
        Pin en {{ form.latitude.toFixed(5) }}, {{ form.longitude.toFixed(5) }}
      </p>
      <p v-if="errors.location" class="fields__error" role="alert">{{ errors.location }}</p>
    </div>
  </div>
</template>

<style scoped>
.fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.fields__prices {
  display: grid;
  gap: var(--space-4);
}

@media (min-width: 480px) {
  .fields__prices {
    grid-template-columns: 1fr 1fr;
  }
}

.fields__map-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.fields__map-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.fields__map-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-brown);
}

.fields__map-hint,
.fields__coords {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.fields__geo {
  padding: var(--space-2) var(--space-3);
  background: var(--color-pending-soft);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}

.fields__map {
  height: 280px;
}

.fields__error {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-error);
}
</style>
