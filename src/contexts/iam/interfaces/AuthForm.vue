<script setup>
import { ref } from 'vue';
import { AUTH_MODES, useAuthForm } from '../application/useAuthForm.js';
import RoleSelector from './RoleSelector.vue';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppCard from '../../../shared/ui/AppCard.vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';
import AppInput from '../../../shared/ui/AppInput.vue';

const emit = defineEmits(['authenticated']);

const { mode, form, errors, formError, submitting, touch, setMode, submit } = useAuthForm({
  onAuthenticated: (role) => emit('authenticated', role),
});

const TABS = [
  { mode: AUTH_MODES.LOGIN, label: 'Iniciar Sesión' },
  { mode: AUTH_MODES.REGISTER, label: 'Registrarse' },
];

const showPassword = ref(false);
const tabRefs = ref([]);

// WAI-ARIA tabs: arrows move between tabs, only the active tab is in the tab order.
function onTabKeydown(event, index) {
  const last = TABS.length - 1;
  const target = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
  }[event.key];
  if (target === undefined) return;
  event.preventDefault();
  setMode(TABS[target].mode);
  tabRefs.value[target]?.focus();
}
</script>

<template>
  <AppCard class="auth-form">
    <div class="auth-form__tabs" role="tablist" aria-label="Acceso a Foodly">
      <button
        v-for="(tab, index) in TABS"
        :id="`auth-tab-${tab.mode}`"
        :key="tab.mode"
        :ref="(el) => (tabRefs[index] = el)"
        type="button"
        role="tab"
        class="auth-form__tab"
        :aria-selected="mode === tab.mode"
        aria-controls="auth-panel"
        :tabindex="mode === tab.mode ? 0 : -1"
        @click="setMode(tab.mode)"
        @keydown="onTabKeydown($event, index)"
      >
        {{ tab.label }}
      </button>
    </div>

    <form
      id="auth-panel"
      class="auth-form__panel"
      role="tabpanel"
      :aria-labelledby="`auth-tab-${mode}`"
      novalidate
      @submit.prevent="submit"
    >
      <h1 class="auth-form__title">
        {{ mode === AUTH_MODES.LOGIN ? 'Bienvenido de vuelta' : 'Crea tu cuenta' }}
      </h1>

      <div v-if="formError" class="auth-form__alert" role="alert">
        <AppIcon name="alert" :size="20" />
        <p>{{ formError }}</p>
      </div>

      <template v-if="mode === AUTH_MODES.REGISTER">
        <RoleSelector v-model="form.role" :error="errors.role" @blur="touch('role')" />
        <AppInput
          v-model="form.name"
          label="Nombre completo"
          autocomplete="name"
          maxlength="150"
          :error="errors.name"
          @blur="touch('name')"
        />
      </template>

      <AppInput
        v-model="form.email"
        label="Correo electrónico"
        type="email"
        autocomplete="email"
        inputmode="email"
        :error="errors.email"
        @blur="touch('email')"
      />

      <template v-if="mode === AUTH_MODES.REGISTER">
        <AppInput
          v-model="form.username"
          label="Nombre de usuario"
          autocomplete="username"
          maxlength="30"
          hint="De 3 a 30 letras, números o guiones bajos."
          :error="errors.username"
          @blur="touch('username')"
        />
        <AppInput
          v-model="form.phone"
          label="Teléfono"
          type="tel"
          autocomplete="tel"
          inputmode="tel"
          optional
          hint="De 9 a 15 dígitos, con + opcional al inicio."
          :error="errors.phone"
          @blur="touch('phone')"
        />
      </template>

      <AppInput
        v-model="form.password"
        label="Contraseña"
        :type="showPassword ? 'text' : 'password'"
        :autocomplete="mode === AUTH_MODES.LOGIN ? 'current-password' : 'new-password'"
        :hint="mode === AUTH_MODES.REGISTER ? 'Entre 8 y 72 caracteres.' : ''"
        :error="errors.password"
        @blur="touch('password')"
      >
        <template #suffix>
          <button
            type="button"
            class="auth-form__toggle"
            :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
            :aria-pressed="showPassword"
            @click="showPassword = !showPassword"
          >
            <AppIcon :name="showPassword ? 'eyeOff' : 'eye'" :size="20" />
          </button>
        </template>
      </AppInput>

      <AppButton type="submit" block :loading="submitting">
        {{ mode === AUTH_MODES.LOGIN ? 'Iniciar sesión' : 'Crear cuenta' }}
      </AppButton>
    </form>
  </AppCard>
</template>

<style scoped>
.auth-form {
  padding: 0;
  overflow: hidden;
}

.auth-form__tabs {
  display: flex;
  background: var(--color-surface-soft);
  border-bottom: 1px solid var(--color-border);
}

.auth-form__tab {
  flex: 1;
  min-height: var(--touch-target);
  padding: var(--space-3) var(--space-4);
  background: none;
  border: 0;
  border-bottom: 3px solid transparent;
  font-weight: 700;
  color: var(--color-text-muted);
  cursor: pointer;
}

.auth-form__tab[aria-selected='true'] {
  background: var(--color-white);
  border-bottom-color: var(--color-primary);
  color: var(--color-primary);
}

.auth-form__panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
}

.auth-form__title {
  font-size: var(--text-xl);
}

.auth-form__alert {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-error-soft);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-error);
}

.auth-form__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-target);
  height: var(--touch-target);
  background: none;
  border: 0;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
}
</style>
