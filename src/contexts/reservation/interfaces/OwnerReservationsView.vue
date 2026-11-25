<script setup>
import { computed, onMounted, ref } from 'vue';
import { useOwnerPage } from '../../business/application/useOwnerPage.js';
import { OWNER_STATUS } from '../../business/application/useOwnerHuariqueStore.js';
import { useReservationStore } from '../application/useReservationStore.js';
import {
  BADGE_BY_STATUS,
  OWNER_TABS,
  RESERVATION_STATUS,
  dayCounters,
  ownerTabOf,
  sortByDateTime,
  toDateString,
} from '../domain/reservation.js';
import { formatDateLong } from '../../../shared/utils/format.js';
import { usePolling } from '../../../shared/utils/usePolling.js';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppCard from '../../../shared/ui/AppCard.vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';
import AppSkeleton from '../../../shared/ui/AppSkeleton.vue';
import EmptyState from '../../../shared/ui/EmptyState.vue';
import ErrorState from '../../../shared/ui/ErrorState.vue';
import StatusBadge from '../../../shared/ui/StatusBadge.vue';
import { useToast } from '../../../shared/ui/useToast.js';

/** W8 "Gestión de Reservas de Lía". */
const { owner, ensureLoaded } = useOwnerPage();
const reservations = useReservationStore();
const toast = useToast();

const tab = ref(OWNER_TABS.PENDING);
const working = ref({}); // reservationId -> true while approving/rejecting

const TABS = [
  { id: OWNER_TABS.PENDING, label: 'Pendientes de Aprobación' },
  { id: OWNER_TABS.APPROVED, label: 'Aprobadas' },
  { id: OWNER_TABS.CLOSED, label: 'Rechazadas / Expiradas' },
];

const today = computed(() => toDateString(new Date()));
const counters = computed(() => dayCounters(reservations.forHuarique, today.value));
const byTab = (id) =>
  sortByDateTime(reservations.forHuarique.filter((r) => ownerTabOf(r.status) === id));
const shown = computed(() => byTab(tab.value));

async function refresh() {
  if (owner.huarique) await reservations.loadForHuarique(owner.huarique.id);
}

async function decide(reservation, action) {
  working.value = { ...working.value, [reservation.id]: true };
  const result = await (action === 'approve'
    ? reservations.approve(reservation.id)
    : reservations.reject(reservation.id));
  working.value = { ...working.value, [reservation.id]: false };
  if (result.ok) {
    toast.success(action === 'approve' ? 'Reserva aprobada.' : 'Reserva rechazada.');
  } else {
    toast.error(result.error);
    refresh(); // someone else (or an expiry) changed it: show the current state
  }
}

usePolling(
  () => owner.huarique && reservations.loadForHuarique(owner.huarique.id, { silent: true }),
  5000,
);
onMounted(async () => {
  await ensureLoaded();
  await refresh();
});
</script>

<template>
  <section class="manage">
    <h1 class="manage__title">Reservas</h1>

    <div
      v-if="owner.status === OWNER_STATUS.LOADING || owner.status === OWNER_STATUS.IDLE"
      role="status"
      aria-busy="true"
    >
      <span class="sr-only">Cargando…</span>
      <AppSkeleton height="120px" />
    </div>
    <ErrorState
      v-else-if="owner.status === OWNER_STATUS.ERROR"
      :message="owner.error"
      @retry="ensureLoaded({ force: true })"
    />

    <template v-else-if="owner.huarique">
      <dl class="counters" aria-label="Resumen del día">
        <div class="counters__tile">
          <dt>Reservas de hoy</dt>
          <dd>{{ counters.total }}</dd>
        </div>
        <div class="counters__tile">
          <dt>Por aprobar hoy</dt>
          <dd>{{ counters.pending }}</dd>
        </div>
        <div class="counters__tile">
          <dt>Aprobadas hoy</dt>
          <dd>{{ counters.approved }}</dd>
        </div>
        <div class="counters__tile">
          <dt>Comensales hoy</dt>
          <dd>{{ counters.guests }}</dd>
        </div>
      </dl>

      <div class="manage__tabs" role="tablist" aria-label="Estado de las reservas">
        <button
          v-for="item in TABS"
          :id="`tab-${item.id}`"
          :key="item.id"
          type="button"
          role="tab"
          class="manage__tab"
          :aria-selected="tab === item.id"
          aria-controls="manage-panel"
          @click="tab = item.id"
        >
          {{ item.label }} <span class="manage__count">{{ byTab(item.id).length }}</span>
        </button>
      </div>

      <div id="manage-panel" role="tabpanel" :aria-labelledby="`tab-${tab}`" class="manage__panel">
        <div
          v-if="reservations.loading && reservations.forHuarique.length === 0"
          role="status"
          aria-busy="true"
        >
          <span class="sr-only">Cargando reservas…</span>
          <AppSkeleton height="140px" />
        </div>
        <ErrorState
          v-else-if="reservations.error && reservations.forHuarique.length === 0"
          :message="reservations.error"
          @retry="refresh"
        />
        <EmptyState
          v-else-if="shown.length === 0"
          icon="calendar"
          title="No hay reservas en esta lista"
          description="Cuando un comensal reserve con Lía, aparecerá aquí."
        />
        <ul v-else class="manage__list">
          <li v-for="reservation in shown" :key="reservation.id">
            <AppCard class="reservation">
              <div class="reservation__header">
                <p class="reservation__diner">{{ reservation.dinerName }}</p>
                <StatusBadge :status="BADGE_BY_STATUS[reservation.status]" />
              </div>
              <dl class="reservation__facts">
                <div>
                  <dt>Hora</dt>
                  <dd>{{ reservation.time }} · {{ formatDateLong(reservation.date) }}</dd>
                </div>
                <div>
                  <dt>Personas</dt>
                  <dd>{{ reservation.partySize }}</dd>
                </div>
                <div>
                  <dt>Zona</dt>
                  <dd>{{ reservation.zone || '—' }}</dd>
                </div>
                <div>
                  <dt>Plato de interés</dt>
                  <dd>{{ reservation.dishOfInterest || '—' }}</dd>
                </div>
              </dl>
              <p v-if="reservation.liaNote" class="reservation__lia">
                <AppIcon name="message" :size="16" /> <strong>Nota de Lía:</strong>
                {{ reservation.liaNote }}
              </p>
              <p v-if="reservation.notes" class="reservation__notes">
                <strong>Notas del comensal:</strong> {{ reservation.notes }}
              </p>

              <div
                v-if="reservation.status === RESERVATION_STATUS.PENDING"
                class="reservation__actions"
              >
                <AppButton
                  variant="success"
                  :loading="working[reservation.id]"
                  @click="decide(reservation, 'approve')"
                >
                  <AppIcon name="check" :size="18" /> Aprobar Reserva
                </AppButton>
                <AppButton
                  variant="danger"
                  :disabled="working[reservation.id]"
                  @click="decide(reservation, 'reject')"
                >
                  <AppIcon name="x" :size="18" /> Rechazar
                </AppButton>
              </div>
            </AppCard>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>

<style scoped>
.manage {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.manage__title {
  font-size: var(--text-2xl);
}

.counters {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  margin: 0;
}

.counters__tile {
  padding: var(--space-4);
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.counters__tile dt {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.counters__tile dd {
  margin: var(--space-1) 0 0;
  font-size: var(--text-2xl);
  font-weight: 800;
  color: var(--color-primary);
}

.manage__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  border-bottom: 2px solid var(--color-border);
}

.manage__tab {
  min-height: var(--touch-target);
  padding: var(--space-2) var(--space-4);
  background: none;
  border: 0;
  border-bottom: 4px solid transparent;
  margin-bottom: -2px;
  font-weight: 700;
  color: var(--color-text-muted);
  cursor: pointer;
}

.manage__tab[aria-selected='true'] {
  border-bottom-color: var(--color-primary);
  color: var(--color-primary);
}

.manage__count {
  display: inline-block;
  min-width: 24px;
  margin-left: var(--space-1);
  padding: 0 var(--space-2);
  background: var(--color-surface-soft);
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  text-align: center;
}

.manage__list {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 900px) {
  .manage__list {
    grid-template-columns: 1fr 1fr;
  }
}

.reservation {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.reservation__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.reservation__diner {
  font-size: var(--text-lg);
  font-weight: 800;
  color: var(--color-brown);
}

.reservation__facts {
  display: grid;
  gap: var(--space-2);
  margin: 0;
}

.reservation__facts div {
  display: flex;
  gap: var(--space-3);
}

.reservation__facts dt {
  min-width: 120px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.reservation__facts dd {
  margin: 0;
  font-weight: 600;
}

.reservation__lia {
  padding: var(--space-3);
  background: var(--color-surface-soft);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.reservation__notes {
  font-size: var(--text-sm);
}

.reservation__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
</style>
