<script setup>
import AppIcon from './AppIcon.vue';

defineProps({
  icon: { type: String, default: 'info' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
});
</script>

<template>
  <div class="empty-state">
    <span class="empty-state__icon"><AppIcon :name="icon" :size="32" /></span>
    <h2 class="empty-state__title">{{ title }}</h2>
    <p v-if="description" class="empty-state__description">{{ description }}</p>
    <div v-if="$slots.default" class="empty-state__actions"><slot /></div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-7) var(--space-5);
  text-align: center;
}

.empty-state__icon {
  display: inline-flex;
  padding: var(--space-4);
  border-radius: 50%;
  background: var(--color-surface-soft);
  color: var(--color-primary);
}

.empty-state__title {
  font-size: var(--text-xl);
}

.empty-state__description {
  max-width: 42ch;
  color: var(--color-text-muted);
}

.empty-state__actions {
  margin-top: var(--space-3);
}
</style>
