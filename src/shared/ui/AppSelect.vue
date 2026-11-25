<script setup>
import { computed, useId } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, required: true },
  /** @type {import('vue').PropType<{ value: string, label: string }[]>} */
  options: { type: Array, required: true },
  error: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'blur']);

const id = useId();
const errorId = `${id}-error`;
const describedBy = computed(() => (props.error ? errorId : undefined));
</script>

<template>
  <div class="app-select" :class="{ 'app-select--invalid': error }">
    <label class="app-select__label" :for="id">{{ label }}</label>
    <select
      :id="id"
      class="app-select__field"
      :value="modelValue"
      :disabled="disabled"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      @change="emit('update:modelValue', $event.target.value)"
      @blur="emit('blur', $event)"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <p v-if="error" :id="errorId" class="app-select__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.app-select {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.app-select__label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-brown);
}

.app-select__field {
  min-height: var(--touch-target);
  padding: var(--space-2) var(--space-4);
  background: var(--color-white);
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font-size: var(--text-md);
}

.app-select__field:focus-visible {
  outline: none;
  border-color: var(--color-focus);
  box-shadow: var(--focus-ring);
}

.app-select--invalid .app-select__field {
  border-color: var(--color-error);
}

.app-select__error {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-error);
}
</style>
