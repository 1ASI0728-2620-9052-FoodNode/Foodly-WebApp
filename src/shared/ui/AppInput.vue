<script setup>
import { computed, useId } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, required: true },
  type: { type: String, default: 'text' },
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
  required: { type: Boolean, default: false },
  optional: { type: Boolean, default: false },
  autocomplete: { type: String, default: undefined },
  inputmode: { type: String, default: undefined },
  maxlength: { type: [Number, String], default: undefined },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'blur']);

const id = useId();
const hintId = `${id}-hint`;
const errorId = `${id}-error`;

const describedBy = computed(
  () => [props.error && errorId, props.hint && hintId].filter(Boolean).join(' ') || undefined,
);
</script>

<template>
  <div class="app-input" :class="{ 'app-input--invalid': error }">
    <label class="app-input__label" :for="id">
      {{ label }}
      <span v-if="optional" class="app-input__optional">(opcional)</span>
    </label>
    <div class="app-input__control">
      <input
        :id="id"
        class="app-input__field"
        :value="modelValue"
        :type="type"
        :required="required"
        :autocomplete="autocomplete"
        :inputmode="inputmode"
        :maxlength="maxlength"
        :disabled="disabled"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="describedBy"
        @input="emit('update:modelValue', $event.target.value)"
        @blur="emit('blur', $event)"
      />
      <span class="app-input__suffix"><slot name="suffix" /></span>
    </div>
    <p v-if="hint && !error" :id="hintId" class="app-input__hint">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="app-input__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.app-input {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.app-input__label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-brown);
}

.app-input__optional {
  font-weight: 400;
  color: var(--color-text-muted);
}

.app-input__control {
  position: relative;
  display: flex;
  align-items: center;
}

.app-input__field {
  width: 100%;
  min-height: var(--touch-target);
  padding: var(--space-2) var(--space-4);
  background: var(--color-white);
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  font-size: var(--text-md);
}

.app-input__field:focus-visible {
  outline: none;
  border-color: var(--color-focus);
  box-shadow: var(--focus-ring);
}

.app-input__field:disabled {
  background: var(--color-surface-soft);
  cursor: not-allowed;
}

.app-input--invalid .app-input__field {
  border-color: var(--color-error);
}

.app-input__suffix {
  position: absolute;
  right: var(--space-1);
  display: inline-flex;
}

.app-input__hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.app-input__error {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-error);
}
</style>
