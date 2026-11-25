<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../application/useAuthStore.js';
import { ROLE_LABELS } from '../domain/roles.js';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppCard from '../../../shared/ui/AppCard.vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';

const auth = useAuthStore();
const router = useRouter();

const rows = computed(() => {
  const profile = auth.profile ?? {};
  return [
    { label: 'Nombre', value: profile.name },
    { label: 'Correo electrónico', value: profile.email },
    { label: 'Usuario', value: profile.username },
    { label: 'Teléfono', value: profile.phone },
    { label: 'Perfil', value: ROLE_LABELS[auth.role] },
  ].map((row) => ({ ...row, value: row.value || '—' }));
});

async function logout() {
  auth.logout();
  await router.replace({ name: 'login' });
}
</script>

<template>
  <section class="profile">
    <h1 class="profile__title">Perfil</h1>
    <AppCard>
      <dl class="profile__list">
        <div v-for="row in rows" :key="row.label" class="profile__row">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
      <RouterLink
        v-if="auth.isExplorer"
        v-slot="{ navigate }"
        :to="{ name: 'my-reservations' }"
        custom
      >
        <AppButton class="profile__link" @click="navigate">
          <AppIcon name="calendar" :size="18" />
          Mis Reservas
        </AppButton>
      </RouterLink>
      <AppButton variant="secondary" @click="logout">
        <AppIcon name="logout" :size="18" />
        Cerrar sesión
      </AppButton>
    </AppCard>
  </section>
</template>

<style scoped>
.profile__title {
  margin-bottom: var(--space-5);
  font-size: var(--text-2xl);
}

.profile__list {
  display: grid;
  gap: var(--space-4);
  margin: 0 0 var(--space-5);
}

.profile__row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile__row dt {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.profile__row dd {
  margin: 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.profile__link {
  margin-right: var(--space-3);
  margin-bottom: var(--space-3);
}
</style>
