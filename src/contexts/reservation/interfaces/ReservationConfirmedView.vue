<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import QRCode from 'qrcode';
import { useReservationStore } from '../application/useReservationStore.js';
import { useHuariqueCatalogStore } from '../../business/application/useHuariqueCatalogStore.js';
import { useReviewStore } from '../../community/application/useReviewStore.js';
import { BADGE_BY_STATUS, RESERVATION_STATUS, isFinal } from '../domain/reservation.js';
import ReviewForm from '../../community/interfaces/ReviewForm.vue';
import { formatDateLong } from '../../../shared/utils/format.js';
import { usePolling } from '../../../shared/utils/usePolling.js';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppCard from '../../../shared/ui/AppCard.vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';
import AppSkeleton from '../../../shared/ui/AppSkeleton.vue';
import EmptyState from '../../../shared/ui/EmptyState.vue';
import ErrorState from '../../../shared/ui/ErrorState.vue';
import StatusBadge from '../../../shared/ui/StatusBadge.vue';

const route = useRoute();
const reservations = useReservationStore();
const catalog = useHuariqueCatalogStore();
const reviews = useReviewStore();

const id = computed(() => String(route.params.id));
const reservation = computed(() => reservations.byId(id.value));
const huarique = ref(null);
const loaded = ref(false);
const showVoucher = ref(false);
const qr = ref('');

const STATUS_COPY = {
  [RESERVATION_STATUS.PENDING]:
    'Esperando la aprobación del huarique. Esta pantalla se actualiza sola.',
  [RESERVATION_STATUS.APPROVED]: '¡Tu mesa está confirmada! Presenta este pase al llegar.',
  [RESERVATION_STATUS.REJECTED]:
    'El huarique no pudo aceptar esta reserva. Prueba con otra fecha u hora.',
  [RESERVATION_STATUS.EXPIRED]: 'La reserva venció sin respuesta. Puedes solicitar otra.',
  [RESERVATION_STATUS.COMPLETED]: 'Ya registraste tu llegada. ¡Esperamos que lo hayas disfrutado!',
};
const canRoute = computed(() =>
  [RESERVATION_STATUS.APPROVED, RESERVATION_STATUS.COMPLETED].includes(reservation.value?.status),
);

const printVoucher = () => window.print();

async function load() {
  if (!reservation.value) await reservations.loadMine();
  loaded.value = true;
  if (reservation.value) {
    huarique.value = await catalog.get(reservation.value.huariqueId).catch(() => null);
    reviews.load(reservation.value.huariqueId);
  }
}

watch(
  () => reservation.value && `${reservation.value.id}|${reservation.value.code}`,
  async () => {
    if (!reservation.value) return;
    qr.value = await QRCode.toDataURL(
      `foodly://reservation/${reservation.value.id}?code=${reservation.value.code}`,
      {
        margin: 1,
        width: 220,
        color: { dark: '#492906', light: '#ffffff' },
      },
    );
  },
  { immediate: true },
);

// Pick up the owner's answer (or a check-in from another tab) while the reservation is still alive.
usePolling(
  () => reservations.loadMine({ silent: true }),
  5000,
  () => reservation.value && !isFinal(reservation.value.status),
);

onMounted(load);
</script>

<template>
  <section class="confirmed">
    <h1 class="confirmed__title">Tu reserva</h1>

    <div v-if="!loaded" role="status" aria-busy="true">
      <span class="sr-only">Cargando tu reserva…</span>
      <AppSkeleton height="320px" />
    </div>
    <ErrorState
      v-else-if="reservations.error && !reservation"
      :message="reservations.error"
      @retry="load"
    />
    <EmptyState v-else-if="!reservation" icon="calendar" title="No encontramos esta reserva">
      <RouterLink v-slot="{ navigate }" :to="{ name: 'my-reservations' }" custom>
        <AppButton @click="navigate">Ver mis reservas</AppButton>
      </RouterLink>
    </EmptyState>

    <template v-else>
      <div class="confirmed__status" role="status">
        <StatusBadge :status="BADGE_BY_STATUS[reservation.status]" />
        <p>{{ STATUS_COPY[reservation.status] }}</p>
      </div>

      <AppCard class="pass" aria-label="Pase digital">
        <div class="pass__info">
          <p class="pass__label">Pase digital</p>
          <p class="pass__huarique">
            {{ huarique?.name ?? reservation.huariqueName ?? 'Huarique' }}
          </p>
          <p class="pass__code" aria-label="Código de reserva">{{ reservation.code }}</p>
          <dl class="pass__details">
            <div>
              <dt>Fecha</dt>
              <dd>{{ formatDateLong(reservation.date) }}</dd>
            </div>
            <div>
              <dt>Hora</dt>
              <dd>{{ reservation.time }}</dd>
            </div>
            <div>
              <dt>Personas</dt>
              <dd>{{ reservation.partySize }}</dd>
            </div>
            <div v-if="reservation.dishOfInterest">
              <dt>Plato de interés</dt>
              <dd>{{ reservation.dishOfInterest }}</dd>
            </div>
          </dl>
        </div>
        <img
          v-if="qr"
          class="pass__qr"
          :src="qr"
          :alt="`Código QR de la reserva ${reservation.code}`"
          width="160"
          height="160"
        />
      </AppCard>

      <div class="confirmed__actions">
        <AppButton
          variant="secondary"
          :aria-expanded="showVoucher"
          @click="showVoucher = !showVoucher"
        >
          <AppIcon name="qr" :size="18" /> {{ showVoucher ? 'Ocultar Voucher' : 'Ver Voucher' }}
        </AppButton>
        <RouterLink
          v-slot="{ navigate }"
          :to="{ name: 'directions', params: { id: reservation.id } }"
          custom
        >
          <AppButton variant="success" :disabled="!canRoute" @click="navigate">
            <AppIcon name="mapPin" :size="18" /> Ir en Ruta
          </AppButton>
        </RouterLink>
      </div>
      <p v-if="!canRoute" class="confirmed__hint">
        “Ir en Ruta” se habilita cuando el huarique aprueba tu reserva.
      </p>

      <AppCard v-if="showVoucher" class="voucher" aria-label="Voucher de la reserva">
        <h2>Voucher de reserva</h2>
        <dl class="voucher__list">
          <div>
            <dt>Código</dt>
            <dd>{{ reservation.code }}</dd>
          </div>
          <div>
            <dt>Huarique</dt>
            <dd>{{ huarique?.name ?? reservation.huariqueName }}</dd>
          </div>
          <div v-if="huarique">
            <dt>Dirección</dt>
            <dd>{{ huarique.address }}</dd>
          </div>
          <div>
            <dt>Comensal</dt>
            <dd>{{ reservation.dinerName }}</dd>
          </div>
          <div>
            <dt>Fecha y hora</dt>
            <dd>{{ formatDateLong(reservation.date) }}, {{ reservation.time }}</dd>
          </div>
          <div>
            <dt>Personas</dt>
            <dd>{{ reservation.partySize }}</dd>
          </div>
          <div v-if="reservation.notes">
            <dt>Notas</dt>
            <dd>{{ reservation.notes }}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{{ reservation.status }}</dd>
          </div>
        </dl>
        <AppButton variant="secondary" @click="printVoucher">Imprimir o guardar como PDF</AppButton>
      </AppCard>

      <AppCard>
        <ReviewForm :key="reservation.status" :reservation="reservation" />
      </AppCard>
    </template>
  </section>
</template>

<style scoped>
.confirmed {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 720px;
  margin: 0 auto;
}

.confirmed__title {
  font-size: var(--text-2xl);
}

.confirmed__status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.pass {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  border: 2px dashed var(--color-primary);
}

.pass__label {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.pass__huarique {
  font-size: var(--text-xl);
  font-weight: 800;
  color: var(--color-brown);
}

.pass__code {
  margin: var(--space-2) 0;
  font-family: ui-monospace, 'Cascadia Code', Menlo, monospace;
  font-size: var(--text-2xl);
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--color-primary);
}

.pass__details,
.voucher__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}

.pass__details div,
.voucher__list div {
  display: flex;
  gap: var(--space-3);
}

.pass__details dt,
.voucher__list dt {
  min-width: 110px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.pass__details dd,
.voucher__list dd {
  margin: 0;
  font-weight: 600;
}

.pass__qr {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.confirmed__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.confirmed__hint {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.voucher {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: flex-start;
}

@media print {
  .confirmed__actions,
  .confirmed__hint {
    display: none;
  }
}
</style>
