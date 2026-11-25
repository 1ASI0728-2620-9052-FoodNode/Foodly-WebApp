<script setup>
import AppIcon from '../../shared/ui/AppIcon.vue';
</script>

<template>
  <div class="auth-layout">
    <header class="auth-layout__brand">
      <span class="auth-layout__logo"><AppIcon name="utensils" :size="28" /></span>
      <span class="auth-layout__name">Foodly</span>
    </header>
    <main id="main" class="auth-layout__main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.auth-layout {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
  min-height: 100vh;
  padding: var(--space-6) var(--space-4) var(--space-7);
  background: linear-gradient(180deg, var(--color-surface-soft) 0%, var(--color-bg) 220px);
}

.auth-layout__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.auth-layout__logo {
  display: inline-flex;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-white);
}

.auth-layout__name {
  font-size: var(--text-2xl);
  font-weight: 800;
  color: var(--color-brown);
}

.auth-layout__main {
  width: 100%;
  max-width: 480px;
}
</style>
