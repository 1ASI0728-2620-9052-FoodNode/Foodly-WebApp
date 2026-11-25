<script setup>
defineProps({
  message: { type: String, default: 'Cargando…' },
});
</script>

<template>
  <div class="loading-state" role="status" aria-live="polite">
    <span class="loading-state__spinner" aria-hidden="true" />
    <p>{{ message }}</p>
  </div>
</template>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-7) var(--space-5);
  color: var(--color-text-muted);
}

.loading-state__spinner {
  width: 36px;
  height: 36px;
  border: 4px solid var(--color-surface-soft);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: loading-state-spin 0.8s linear infinite;
}

@keyframes loading-state-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
