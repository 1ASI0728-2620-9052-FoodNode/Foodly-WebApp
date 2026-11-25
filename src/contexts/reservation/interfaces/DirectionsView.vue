<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useReservationStore } from '../application/useReservationStore.js';
import { useHuariqueCatalogStore } from '../../business/application/useHuariqueCatalogStore.js';
import { useRadarStore } from '../../radar/application/useRadarStore.js';
import { useLiaDrawerStore } from '../../messaging/application/useLiaDrawerStore.js';
import { RESERVATION_STATUS } from '../domain/reservation.js';
import { distanceMeters, googleMapsDirectionsUrl } from '../../../shared/geo/distance.js';
import { DISTRICTS, findDistrict } from '../../../shared/geo/districts.js';
import { buildCoverage } from '../../../shared/geo/h3Zone.js';
import { GEO_ERRORS, getCurrentLocation } from '../../../shared/geo/geolocation.js';
import { formatDistance } from '../../../shared/utils/format.js';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppCard from '../../../shared/ui/AppCard.vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';
import AppMap from '../../../shared/ui/AppMap.vue';
import AppSelect from '../../../shared/ui/AppSelect.vue';
import AppSkeleton from '../../../shared/ui/AppSkeleton.vue';
import EmptyState from '../../../shared/ui/EmptyState.vue';
import { useToast } from '../../../shared/ui/useToast.js';

/**
 * W5 "Cómo llegar". The project scope excludes route calculation: this screen draws a STRAIGHT line
 * between the user and the huarique, with the straight-line distance and the H3 zone of each.
 */
const route = useRoute();
const router = useRouter();
const toast = useToast();
const reservations = useReservationStore();
const catalog = useHuariqueCatalogStore();
const radar = useRadarStore();
const liaDrawer = useLiaDrawerStore();

const reservation = computed(() => reservations.byId(String(route.params.id)));
const huarique = ref(null);
const loaded = ref(false);
const origin = ref(radar.location ? { ...radar.location } : null);
const locating = ref(false);
const geoError = ref('');
const checkingIn = ref(false);

const districtOptions = [
  { value: '', label: 'Elige tu distrito' },
  ...DISTRICTS.map((d) => ({ value: d.id, label: d.name })),
];

const destination = computed(() => huarique.value?.location ?? null);
const meters = computed(() =>
  origin.value && destination.value ? distanceMeters(origin.value, destination.value) : null,
);
const zones = computed(() => {
  if (!destination.value) return null;
  const to = buildCoverage(destination.value, 0);
  const from = origin.value ? buildCoverage(origin.value, 0) : null;
  return { to, from, same: from?.origin === to.origin };
});
const polygons = computed(() => [
  ...(zones.value?.from && !zones.value.same
    ? [{ id: 'from', latLngs: zones.value.from.polygons[0].latLngs, highlight: false }]
    : []),
  ...(zones.value
    ? [{ id: 'to', latLngs: zones.value.to.polygons[0].latLngs, highlight: true }]
    : []),
]);
const markers = computed(() => [
  ...(origin.value
    ? [
        {
          id: 'user',
          kind: 'user',
          label: 'Tu ubicación',
          latitude: origin.value.latitude,
          longitude: origin.value.longitude,
        },
      ]
    : []),
  ...(destination.value
    ? [{ id: 'huarique', kind: 'huarique', label: huarique.value.name, ...destination.value }]
    : []),
]);
const polylines = computed(() =>
  origin.value && destination.value
    ? [
        {
          id: 'line',
          latLngs: [
            [origin.value.latitude, origin.value.longitude],
            [destination.value.latitude, destination.value.longitude],
          ],
        },
      ]
    : [],
);

const liaMessages = computed(() => {
  if (!reservation.value || !huarique.value) return [];
  const r = reservation.value;
  return [
    `¡Todo listo! Tu mesa para ${r.partySize} ${r.partySize === 1 ? 'persona' : 'personas'} en ${huarique.value.name} es a las ${r.time}.`,
    `Te esperan en ${huarique.value.address}.`,
    meters.value !== null
      ? `Estás a ${formatDistance(meters.value)} en línea recta. Cuando llegues, toca “Ya llegué al local”.`
      : 'Comparte tu ubicación para decirte qué tan lejos estás.',
  ];
});

const canCheckIn = computed(() => reservation.value?.status === RESERVATION_STATUS.APPROVED);

async function locate() {
  locating.value = true;
  geoError.value = '';
  try {
    origin.value = { ...(await getCurrentLocation()), source: 'gps' };
  } catch (cause) {
    geoError.value =
      cause?.code === GEO_ERRORS.DENIED
        ? 'No tenemos permiso para ver tu ubicación. Elige tu distrito para estimar la distancia.'
        : 'No pudimos ubicarte. Elige tu distrito para estimar la distancia.';
  } finally {
    locating.value = false;
  }
}

function chooseDistrict(districtId) {
  const district = findDistrict(districtId);
  if (district)
    origin.value = {
      latitude: district.latitude,
      longitude: district.longitude,
      source: 'district',
    };
}

async function checkIn() {
  checkingIn.value = true;
  const result = await reservations.checkIn(reservation.value.id);
  checkingIn.value = false;
  if (result.ok) {
    toast.success('¡Llegaste! Registramos tu check-in. Cuéntanos qué tal estuvo.');
    await router.replace({ name: 'reservation-detail', params: { id: reservation.value.id } });
  } else {
    toast.error(result.error);
  }
}

onMounted(async () => {
  if (!reservation.value) await reservations.loadMine();
  if (reservation.value)
    huarique.value = await catalog.get(reservation.value.huariqueId).catch(() => null);
  loaded.value = true;
  if (!origin.value) locate();
});
</script>

<template>
  <section class="directions">
    <RouterLink
      v-if="reservation"
      class="directions__back"
      :to="{ name: 'reservation-detail', params: { id: reservation.id } }"
    >
      ← Volver a mi reserva
    </RouterLink>
    <h1 class="directions__title">Cómo llegar</h1>

    <div v-if="!loaded" role="status" aria-busy="true">
      <span class="sr-only">Cargando…</span>
      <AppSkeleton height="320px" />
    </div>
    <EmptyState
      v-else-if="!reservation || !huarique"
      icon="mapPin"
      title="No pudimos cargar esta reserva"
    />

    <template v-else>
      <p class="directions__destination">
        <strong>{{ huarique.name }}</strong> · {{ huarique.address }}
      </p>

      <div v-if="geoError" class="directions__alert" role="status">
        <AppIcon name="info" :size="20" /> {{ geoError }}
      </div>
      <div class="directions__where">
        <AppButton variant="secondary" :loading="locating" @click="locate">
          <AppIcon name="mapPin" :size="18" /> Usar mi ubicación
        </AppButton>
        <AppSelect
          :model-value="''"
          label="O elige tu distrito"
          :options="districtOptions"
          @update:model-value="chooseDistrict"
        />
      </div>

      <div class="directions__map">
        <AppMap
          :center="destination"
          :zoom="15"
          :markers="markers"
          :polygons="polygons"
          :polylines="polylines"
          :fit-token="`${origin?.latitude}-${origin?.longitude}`"
          aria-label="Mapa con tu ubicación, el huarique y la línea recta entre ambos"
        />
      </div>

      <AppCard>
        <dl class="directions__facts">
          <div>
            <dt>Distancia en línea recta</dt>
            <dd>{{ meters !== null ? formatDistance(meters) : 'Comparte tu ubicación' }}</dd>
          </div>
          <div>
            <dt>Zona H3 del huarique</dt>
            <dd class="directions__cell">{{ zones.to.origin }}</dd>
          </div>
          <div v-if="zones.from">
            <dt>Tu zona H3</dt>
            <dd class="directions__cell">
              {{ zones.from.origin }}<span v-if="zones.same"> · la misma zona</span>
            </dd>
          </div>
        </dl>
        <p class="directions__note">
          La línea recta es una referencia: Foodly no calcula rutas. Usa Google Maps para el
          recorrido.
        </p>
        <a
          class="directions__external"
          :href="googleMapsDirectionsUrl(huarique.location)"
          target="_blank"
          rel="noopener noreferrer"
        >
          <AppIcon name="mapPin" :size="18" /> Abrir en Google Maps
          <span class="sr-only">(se abre en una pestaña nueva)</span>
        </a>
      </AppCard>

      <AppCard soft aria-label="Mensajes de Lía">
        <h2 class="directions__lia-title"><AppIcon name="message" :size="20" /> Lía te acompaña</h2>
        <ul class="directions__lia">
          <li v-for="message in liaMessages" :key="message">{{ message }}</li>
        </ul>
        <AppButton
          variant="secondary"
          @click="
            liaDrawer.open({
              huariqueId: huarique.id,
              huariqueName: huarique.name,
              location: origin,
            })
          "
        >
          Preguntar a Lía
        </AppButton>
      </AppCard>

      <div class="directions__checkin">
        <AppButton
          variant="success"
          block
          :loading="checkingIn"
          :disabled="!canCheckIn"
          @click="checkIn"
        >
          <AppIcon name="check" :size="18" /> Ya llegué al local
        </AppButton>
        <p v-if="!canCheckIn" class="directions__note">
          {{
            reservation.status === RESERVATION_STATUS.COMPLETED
              ? 'Ya registraste tu llegada.'
              : 'El check-in se habilita cuando tu reserva está aprobada.'
          }}
        </p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.directions {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 760px;
  margin: 0 auto;
}

.directions__back {
  display: inline-flex;
  align-items: center;
  min-height: var(--touch-target);
  font-weight: 600;
}

.directions__title {
  font-size: var(--text-2xl);
}

.directions__alert {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-pending-soft);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.directions__where {
  display: grid;
  gap: var(--space-3);
  align-items: end;
}

@media (min-width: 640px) {
  .directions__where {
    grid-template-columns: auto minmax(0, 1fr);
  }
}

.directions__map {
  height: 340px;
}

.directions__facts {
  display: grid;
  gap: var(--space-3);
  margin: 0 0 var(--space-3);
}

.directions__facts dt {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.directions__facts dd {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 800;
  color: var(--color-brown);
}

.directions__cell {
  font-family: ui-monospace, 'Cascadia Code', Menlo, monospace;
  font-size: var(--text-sm) !important;
  overflow-wrap: anywhere;
}

.directions__note {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.directions__external {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch-target);
  margin-top: var(--space-3);
  font-weight: 700;
}

.directions__lia-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  font-size: var(--text-lg);
}

.directions__lia {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0 0 var(--space-4);
  padding-left: var(--space-5);
}

.directions__checkin {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
