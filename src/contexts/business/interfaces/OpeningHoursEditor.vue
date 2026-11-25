<script setup>
import { DAY_LABELS, DAY_ORDER } from '../domain/huarique.js';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';

/** Opening hours as a flat list of { day, opensAt, closesAt }; a day can have several ranges. */
const props = defineProps({
  modelValue: { type: Array, required: true },
  error: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);

const slotsOf = (day) =>
  props.modelValue.map((slot, index) => ({ slot, index })).filter(({ slot }) => slot.day === day);

function update(index, patch) {
  emit(
    'update:modelValue',
    props.modelValue.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)),
  );
}

function add(day) {
  emit('update:modelValue', [...props.modelValue, { day, opensAt: '12:00', closesAt: '22:00' }]);
}

function remove(index) {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, i) => i !== index),
  );
}

function fillWeek() {
  emit(
    'update:modelValue',
    DAY_ORDER.slice(0, 6).map((day) => ({ day, opensAt: '12:00', closesAt: '22:00' })),
  );
}
</script>

<template>
  <fieldset class="hours" :aria-describedby="error ? 'hours-error' : undefined">
    <legend class="hours__legend">Días y horas de atención</legend>

    <AppButton variant="secondary" @click="fillWeek"
      >Rellenar de lunes a sábado (12:00 – 22:00)</AppButton
    >

    <div v-for="day in DAY_ORDER" :key="day" class="hours__day">
      <h4 class="hours__day-name">{{ DAY_LABELS[day] }}</h4>
      <p v-if="slotsOf(day).length === 0" class="hours__closed">Cerrado</p>
      <div v-for="{ slot, index } in slotsOf(day)" :key="index" class="hours__slot">
        <label>
          <span class="sr-only">{{ DAY_LABELS[day] }}: abre a las</span>
          <input
            type="time"
            :value="slot.opensAt"
            @input="update(index, { opensAt: $event.target.value })"
          />
        </label>
        <span aria-hidden="true">–</span>
        <label>
          <span class="sr-only">{{ DAY_LABELS[day] }}: cierra a las</span>
          <input
            type="time"
            :value="slot.closesAt"
            @input="update(index, { closesAt: $event.target.value })"
          />
        </label>
        <button
          type="button"
          class="hours__remove"
          :aria-label="`Quitar horario del ${DAY_LABELS[day]}`"
          @click="remove(index)"
        >
          <AppIcon name="x" :size="18" />
        </button>
      </div>
      <button type="button" class="hours__add" @click="add(day)">
        + Agregar horario <span class="sr-only">del {{ DAY_LABELS[day] }}</span>
      </button>
    </div>

    <p v-if="error" id="hours-error" class="hours__error" role="alert">{{ error }}</p>
  </fieldset>
</template>

<style scoped>
.hours {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.hours__legend {
  margin-bottom: var(--space-2);
  padding: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-brown);
}

.hours__day {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}

.hours__day-name {
  min-width: 96px;
  font-size: var(--text-sm);
}

.hours__closed {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.hours__slot {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.hours__slot input {
  min-height: var(--touch-target);
  padding: var(--space-1) var(--space-2);
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
}

.hours__remove,
.hours__add {
  min-height: var(--touch-target);
  min-width: var(--touch-target);
  background: none;
  border: 0;
  font-weight: 600;
  color: var(--color-primary);
  cursor: pointer;
}

.hours__remove {
  color: var(--color-text-muted);
}

.hours__error {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-error);
}
</style>
