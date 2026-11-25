<script setup>
import AppButton from '../../shared/ui/AppButton.vue';
import EmptyState from '../../shared/ui/EmptyState.vue';
</script>

<template>
  <main id="main" class="status-page">
    <EmptyState
      icon="lock"
      title="403 · Acceso denegado"
      description="Tu perfil no tiene permiso para ver esta página."
    >
      <RouterLink v-slot="{ navigate }" to="/" custom>
        <AppButton @click="navigate">Volver al inicio</AppButton>
      </RouterLink>
    </EmptyState>
  </main>
</template>

<style scoped>
.status-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: var(--space-5);
}
</style>
