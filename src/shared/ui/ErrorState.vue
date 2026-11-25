<script setup>
import AppButton from './AppButton.vue';
import AppIcon from './AppIcon.vue';

defineProps({
  title: { type: String, default: 'Algo salió mal' },
  message: { type: String, default: 'No pudimos completar la operación. Inténtalo de nuevo.' },
  retryable: { type: Boolean, default: true },
});

defineEmits(['retry']);
</script>

<template>
  <div class="error-state" role="alert">
    <span class="error-state__icon"><AppIcon name="alert" :size="32" /></span>
    <h2 class="error-state__title">{{ title }}</h2>
    <p class="error-state__message">{{ message }}</p>
    <AppButton v-if="retryable" variant="secondary" @click="$emit('retry')">
      <AppIcon name="refresh" :size="18" />
      Reintentar
    </AppButton>
  </div>
</template>

<style scoped>
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-7) var(--space-5);
  text-align: center;
}

.error-state__icon {
  display: inline-flex;
  padding: var(--space-4);
  border-radius: 50%;
  background: var(--color-error-soft);
  color: var(--color-error);
}

.error-state__title {
  font-size: var(--text-xl);
}

.error-state__message {
  max-width: 42ch;
  color: var(--color-text-muted);
}
</style>
