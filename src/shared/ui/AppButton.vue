<script setup>
defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'danger', 'success'].includes(value),
  },
  type: { type: String, default: 'button' },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  block: { type: Boolean, default: false },
});
</script>

<template>
  <button
    class="app-button"
    :class="[`app-button--${variant}`, { 'app-button--block': block }]"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <span v-if="loading" class="app-button__spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--touch-target);
  min-width: var(--touch-target);
  padding: var(--space-2) var(--space-5);
  border: 2px solid transparent;
  border-radius: var(--radius-pill);
  font-weight: 700;
  font-size: var(--text-md);
  line-height: 1.2;
  cursor: pointer;
  transition:
    background-color 0.15s,
    box-shadow 0.15s,
    transform 0.05s;
}

.app-button--block {
  width: 100%;
}

.app-button:active:not(:disabled) {
  transform: translateY(1px);
}

.app-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.app-button--primary {
  background: var(--color-primary);
  color: var(--color-white);
  box-shadow: var(--shadow-sm);
}
.app-button--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.app-button--secondary {
  background: var(--color-white);
  color: var(--color-primary);
  border-color: var(--color-primary);
}
.app-button--secondary:hover:not(:disabled) {
  background: var(--color-surface-soft);
}

.app-button--danger {
  background: var(--color-error);
  color: var(--color-white);
}
.app-button--danger:hover:not(:disabled) {
  background: var(--color-error-hover);
}

.app-button--success {
  background: var(--color-success);
  color: var(--color-white);
}
.app-button--success:hover:not(:disabled) {
  background: var(--color-success-dark);
}

.app-button__spinner {
  width: 1em;
  height: 1em;
  border: 2px solid currentcolor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: app-button-spin 0.7s linear infinite;
}

@keyframes app-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
