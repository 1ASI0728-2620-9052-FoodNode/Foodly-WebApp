<script setup>
import { computed, onMounted, ref } from 'vue';
import { useReservationStore } from '../application/useReservationStore.js';
import { useHuariqueCatalogStore } from '../../business/application/useHuariqueCatalogStore.js';
import {
  BADGE_BY_STATUS,
  isFinal,
  reservationDateTime,
  sortByDateTime,
} from '../domain/reservation.js';
import { formatDateLong } from '../../../shared/utils/format.js';
import { usePolling } from '../../../shared/utils/usePolling.js';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppSkeleton from '../../../shared/ui/AppSkeleton.vue';
import EmptyState from '../../../shared/ui/EmptyState.vue';
import ErrorState from '../../../shared/ui/ErrorState.vue';
import StatusBadge from '../../../shared/ui/StatusBadge.vue';

const reservations = useReservationStore();
const catalog = useHuariqueCatalogStore();

const names = ref({}); // huariqueId -> name (the real service may not send it)
const tab = ref('upcoming'); // 'upcoming' | 'history'

const upcoming = computed(() =>
  sortByDateTime(
    reservations.mine.filter((r) => !isFinal(r.status) && reservationDateTime(r) > new Date()),
  ),
);
const history = computed(() => {
  const upcomingIds = new Set(upcoming.value.map((r) => r.id));
  return sortByDateTime(
    reservations.mine.filter((r) => !upcomingIds.has(r.id)),
    'desc',
  );
});
const shown = computed(() => (tab.value === 'upcoming' ? upcoming.value : history.value));

async function load() {
  await reservations.loadMine();
  const missing = reservations.mine.filter((r) => !r.huariqueName).map((r) => r.huariqueId);
  if (missing.length) {
    const { huariques } = await catalog.loadMany(missing);
    names.value = Object.fromEntries([...huariques].map(([id, h]) => [id, h.name]));
  }
}

usePolling(() => reservations.loadMine({ silent: true }), 8000);
onMounted(load);
</script>

<template>
  <section class="mine">
    <h1 class="mine__title">Mis Reservas</h1>

    <div class="mine__tabs" role="group" aria-label="Mostrar">
      <AppButton
        :variant="tab === 'upcoming' ? 'primary' : 'secondary'"
        :aria-pressed="tab === 'upcoming'"
        @click="tab = 'upcoming'"
      >
        Próximas ({{ upcoming.length }})
      </AppButton>
      <AppButton
        :variant="tab === 'history' ? 'primary' : 'secondary'"
        :aria-pressed="tab === 'history'"
        @click="tab = 'history'"
      >
        Historial ({{ history.length }})
      </AppButton>
    </div>

    <div
      v-if="reservations.loading && reservations.mine.length === 0"
      role="status"
      aria-busy="true"
    >
      <span class="sr-only">Cargando tus reservas…</span>
      <AppSkeleton v-for="n in 3" :key="n" height="88px" class="mine__skeleton" />
    </div>
    <ErrorState
      v-else-if="reservations.error && reservations.mine.length === 0"
      :message="reservations.error"
      @retry="load"
    />
    <EmptyState
      v-else-if="shown.length === 0"
      icon="calendar"
      :title="tab === 'upcoming' ? 'No tienes reservas próximas' : 'Aún no tienes historial'"
      description="Elige un huarique en el Radar y reserva tu mesa."
    >
      <RouterLink v-slot="{ navigate }" :to="{ name: 'radar' }" custom>
        <AppButton @click="navigate">Ir al Radar</AppButton>
      </RouterLink>
    </EmptyState>

    <ul v-else class="mine__list">
      <li v-for="reservation in shown" :key="reservation.id">
        <RouterLink
          class="card"
          :to="{ name: 'reservation-detail', params: { id: reservation.id } }"
        >
          <div class="card__body">
            <p class="card__name">
              {{ reservation.huariqueName || names[reservation.huariqueId] || 'Huarique' }}
            </p>
            <p class="card__when">
              {{ formatDateLong(reservation.date) }} · {{ reservation.time }} ·
              {{ reservation.partySize }} {{ reservation.partySize === 1 ? 'persona' : 'personas' }}
            </p>
          </div>
          <StatusBadge :status="BADGE_BY_STATUS[reservation.status]" />
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.mine {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.mine__title {
  font-size: var(--text-2xl);
}

.mine__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.mine__skeleton {
  margin-bottom: var(--space-3);
}

.mine__list {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-white);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
  color: inherit;
  text-decoration: none;
}

.card:hover {
  border-color: var(--color-primary);
}

.card__name {
  font-size: var(--text-lg);
  font-weight: 800;
  color: var(--color-brown);
}

.card__when {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
</style>
