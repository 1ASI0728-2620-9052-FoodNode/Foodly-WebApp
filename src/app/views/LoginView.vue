<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AuthForm from '../../contexts/iam/interfaces/AuthForm.vue';
import AppIcon from '../../shared/ui/AppIcon.vue';
import { useToast } from '../../shared/ui/useToast.js';
import { resolvePostLoginRoute } from '../postLoginRoute.js';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const SESSION_NOTICES = {
  expired: 'Tu sesión expiró. Inicia sesión nuevamente para continuar.',
  unauthorized: 'Tu sesión ya no es válida. Inicia sesión nuevamente.',
};

const notice = computed(() => SESSION_NOTICES[route.query.reason] ?? '');

async function onAuthenticated(role) {
  const { path, degraded } = await resolvePostLoginRoute(role);
  if (degraded) {
    toast.warning('No pudimos verificar el estado de tu huarique. Inténtalo de nuevo más tarde.');
  }
  await router.replace(path);
}
</script>

<template>
  <div class="login-view">
    <p v-if="notice" class="login-view__notice" role="status">
      <AppIcon name="info" :size="20" />
      {{ notice }}
    </p>
    <AuthForm @authenticated="onAuthenticated" />
  </div>
</template>

<style scoped>
.login-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.login-view__notice {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-pending-soft);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-brown);
}
</style>
