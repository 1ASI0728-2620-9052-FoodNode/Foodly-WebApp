<script setup>
defineProps({
  as: { type: String, default: 'div' },
  /** Soft background instead of white, for nested or secondary content. */
  soft: { type: Boolean, default: false },
  padded: { type: Boolean, default: true },
});
</script>

<template>
  <component
    :is="as"
    class="app-card"
    :class="{ 'app-card--soft': soft, 'app-card--padded': padded }"
  >
    <slot />
  </component>
</template>

<style scoped>
.app-card {
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.app-card--soft {
  background: var(--color-surface-soft);
  box-shadow: var(--shadow-sm);
}

.app-card--padded {
  padding: var(--space-5);
}
</style>
