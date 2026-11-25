<script setup>
import { computed, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useReservationStore } from '../application/useReservationStore.js';
import { DETAIL_STATUS, useHuariqueDetail } from '../../business/application/useHuariqueDetail.js';
import {
  NOTES_MAX,
  PARTY_SIZE_MAX,
  PARTY_SIZE_MIN,
  hoursLabelFor,
  toDateString,
} from '../domain/reservation.js';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppCard from '../../../shared/ui/AppCard.vue';
import AppInput from '../../../shared/ui/AppInput.vue';
import AppSelect from '../../../shared/ui/AppSelect.vue';
import AppSkeleton from '../../../shared/ui/AppSkeleton.vue';
import EmptyState from '../../../shared/ui/EmptyState.vue';
import ErrorState from '../../../shared/ui/ErrorState.vue';
import { useToast } from '../../../shared/ui/useToast.js';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const reservations = useReservationStore();
const { status, huarique, menu, reload } = useHuariqueDetail(() => String(route.params.id));

const today = toDateString(new Date());
const form = reactive({ date: today, time: '', partySize: 2, notes: '', dishOfInterest: '' });
const errors = ref({});
const submitError = ref('');
const submitting = ref(false);

const fromLia = computed(() => route.query.from === 'lia');
const hoursHint = computed(() => {
  if (!huarique.value || !form.date) return '';
  const { day, text } = hoursLabelFor(huarique.value.openingHours, form.date);
  return text === 'cerrado'
    ? `Los ${day.toLowerCase()} el huarique no atiende.`
    : `Horario del ${day.toLowerCase()}: ${text}`;
});
const dishOptions = computed(() => [
  { value: '', label: 'Sin preferencia' },
  ...menu.value.categories.flatMap((c) =>
    c.dishes.filter((d) => d.available).map((d) => ({ value: d.name, label: d.name })),
  ),
]);

async function submit() {
  submitError.value = '';
  submitting.value = true;
  const result = await reservations.create({
    huarique: huarique.value,
    form,
    fromLia: fromLia.value,
  });
  submitting.value = false;
  errors.value = result.errors ?? {};
  if (result.ok) {
    toast.success('Enviamos tu solicitud. El huarique te confirmará pronto.');
    await router.replace({ name: 'reservation-detail', params: { id: result.reservation.id } });
  } else if (result.error) {
    submitError.value = result.error;
  }
}
</script>

<template>
  <section class="reserve">
    <RouterLink
      class="reserve__back"
      :to="{ name: 'huarique-detail', params: { id: String(route.params.id) } }"
    >
      ← Volver al huarique
    </RouterLink>
    <h1 class="reserve__title">Reservar Mesa</h1>

    <div v-if="status === DETAIL_STATUS.LOADING" role="status" aria-busy="true">
      <span class="sr-only">Cargando el huarique…</span>
      <AppSkeleton height="320px" />
    </div>
    <ErrorState v-else-if="status === DETAIL_STATUS.ERROR" @retry="reload" />
    <EmptyState
      v-else-if="status === DETAIL_STATUS.NOT_FOUND"
      icon="store"
      title="Este huarique ya no está disponible"
    />

    <AppCard v-else>
      <form class="reserve__form" novalidate @submit.prevent="submit">
        <p class="reserve__huarique">{{ huarique.name }}</p>
        <p v-if="fromLia" class="reserve__lia">
          Confirma los datos que armó Lía y envía tu solicitud.
        </p>

        <AppInput
          v-model="form.date"
          label="Fecha"
          type="date"
          :min="today"
          :error="errors.date"
          :hint="hoursHint"
        />
        <AppInput v-model="form.time" label="Hora" type="time" step="900" :error="errors.time" />
        <AppInput
          v-model="form.partySize"
          label="Número de personas"
          type="number"
          inputmode="numeric"
          :min="PARTY_SIZE_MIN"
          :max="PARTY_SIZE_MAX"
          :error="errors.partySize"
        />
        <AppSelect v-model="form.dishOfInterest" label="Plato de interés" :options="dishOptions" />

        <div class="reserve__notes">
          <label for="reserve-notes">Notas para el huarique <span>(opcional)</span></label>
          <textarea id="reserve-notes" v-model="form.notes" rows="3" :maxlength="NOTES_MAX" />
          <p v-if="errors.notes" class="reserve__error">{{ errors.notes }}</p>
        </div>

        <p v-if="submitError" class="reserve__error" role="alert">{{ submitError }}</p>
        <AppButton type="submit" block :loading="submitting">Solicitar reserva</AppButton>
      </form>
    </AppCard>
  </section>
</template>

<style scoped>
.reserve {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 560px;
  margin: 0 auto;
}

.reserve__back {
  display: inline-flex;
  align-items: center;
  min-height: var(--touch-target);
  font-weight: 600;
}

.reserve__title {
  font-size: var(--text-2xl);
}

.reserve__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.reserve__huarique {
  font-size: var(--text-lg);
  font-weight: 800;
  color: var(--color-primary);
}

.reserve__lia {
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-soft);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.reserve__notes {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.reserve__notes label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-brown);
}

.reserve__notes label span {
  font-weight: 400;
  color: var(--color-text-muted);
}

.reserve__notes textarea {
  padding: var(--space-3) var(--space-4);
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  resize: vertical;
}

.reserve__notes textarea:focus-visible {
  outline: none;
  border-color: var(--color-focus);
  box-shadow: var(--focus-ring);
}

.reserve__error {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-error);
}
</style>
