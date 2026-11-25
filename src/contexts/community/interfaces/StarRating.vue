<script setup>
import { useId } from 'vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';

/**
 * 1-5 stars. Editable: a radio-like group of buttons. Read-only: stars plus the number as text,
 * so the value never depends on color or shape alone.
 */
const props = defineProps({
  modelValue: { type: Number, default: 0 },
  label: { type: String, default: 'Calificación' },
  readonly: { type: Boolean, default: false },
  error: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);
const id = useId();
const stars = [1, 2, 3, 4, 5];
const filled = (n) => n <= Math.round(props.modelValue);
</script>

<template>
  <div v-if="readonly" class="stars stars--readonly">
    <span class="stars__row" aria-hidden="true">
      <AppIcon
        v-for="n in stars"
        :key="n"
        name="star"
        :size="16"
        :class="{ 'is-filled': filled(n) }"
      />
    </span>
    <span class="stars__value"
      >{{ modelValue.toFixed(1) }} de 5<span class="sr-only"> estrellas, {{ label }}</span></span
    >
  </div>

  <fieldset v-else class="stars" :aria-describedby="error ? `${id}-error` : undefined">
    <legend class="stars__label">{{ label }}</legend>
    <div class="stars__row stars__row--edit">
      <button
        v-for="n in stars"
        :key="n"
        type="button"
        class="stars__button"
        :aria-label="`${n} ${n === 1 ? 'estrella' : 'estrellas'}`"
        :aria-pressed="modelValue === n"
        @click="emit('update:modelValue', n)"
      >
        <AppIcon name="star" :size="28" :class="{ 'is-filled': n <= modelValue }" />
      </button>
      <span class="stars__value" aria-live="polite">{{
        modelValue ? `${modelValue} de 5` : 'Sin calificar'
      }}</span>
    </div>
    <p v-if="error" :id="`${id}-error`" class="stars__error">{{ error }}</p>
  </fieldset>
</template>

<style scoped>
.stars {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.stars--readonly {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.stars__label {
  margin-bottom: var(--space-1);
  padding: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-brown);
}

.stars__row {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--color-border-strong);
}

.stars__row--edit {
  gap: var(--space-1);
}

.stars__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-target);
  height: var(--touch-target);
  padding: 0;
  background: none;
  border: 0;
  border-radius: 50%;
  color: var(--color-border-strong);
  cursor: pointer;
}

.is-filled {
  fill: var(--color-pending);
  color: var(--color-pending);
}

.stars__value {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-brown);
}

.stars__error {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-error);
}
</style>
