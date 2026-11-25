<script setup>
defineProps({
  height: { type: String, default: '1rem' },
  width: { type: String, default: '100%' },
});
</script>

<template>
  <span class="app-skeleton" aria-hidden="true" :style="{ height, width }" />
</template>

<style scoped>
.app-skeleton {
  display: block;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    90deg,
    var(--color-surface-soft) 25%,
    var(--color-border) 50%,
    var(--color-surface-soft) 75%
  );
  background-size: 200% 100%;
  animation: app-skeleton-shimmer 1.4s ease-in-out infinite;
}

@keyframes app-skeleton-shimmer {
  to {
    background-position: -200% 0;
  }
}
</style>
