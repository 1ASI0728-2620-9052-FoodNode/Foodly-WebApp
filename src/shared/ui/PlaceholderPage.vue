<script setup>
import AppCard from '../../shared/ui/AppCard.vue';
import EmptyState from '../../shared/ui/EmptyState.vue';

defineProps({
  title: { type: String, required: true },
  icon: { type: String, default: 'info' },
  description: {
    type: String,
    default: 'Esta pantalla se construye en una fase posterior del proyecto.',
  },
});
</script>

<template>
  <section>
    <h1 class="placeholder-title">{{ title }}</h1>
    <AppCard>
      <EmptyState :icon="icon" title="Próximamente" :description="description" />
    </AppCard>
  </section>
</template>

<style scoped>
.placeholder-title {
  margin-bottom: var(--space-5);
  font-size: var(--text-2xl);
}
</style>
