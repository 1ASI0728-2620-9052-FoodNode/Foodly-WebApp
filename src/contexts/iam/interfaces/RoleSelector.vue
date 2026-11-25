<script setup>
import { ROLES, ROLE_LABELS } from '../domain/roles.js';
import AppIcon from '../../../shared/ui/AppIcon.vue';

defineProps({
  modelValue: { type: String, required: true },
  error: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue', 'blur']);

const OPTIONS = [
  {
    value: ROLES.EXPLORER,
    icon: 'mapPin',
    description: 'Descubre huariques cerca de ti y reserva.',
  },
  {
    value: ROLES.OWNER,
    icon: 'store',
    description: 'Administra tu huarique, tu carta y tus reservas.',
  },
];
</script>

<template>
  <fieldset class="role-selector">
    <legend class="role-selector__legend">¿Cómo usarás Foodly?</legend>
    <div class="role-selector__options">
      <label
        v-for="option in OPTIONS"
        :key="option.value"
        class="role-option"
        :class="{ 'role-option--selected': modelValue === option.value }"
      >
        <input
          class="sr-only"
          type="radio"
          name="role"
          :value="option.value"
          :checked="modelValue === option.value"
          @change="emit('update:modelValue', option.value)"
          @blur="emit('blur')"
        />
        <AppIcon :name="option.icon" :size="24" />
        <span class="role-option__title">{{ ROLE_LABELS[option.value] }}</span>
        <span class="role-option__description">{{ option.description }}</span>
        <span v-if="modelValue === option.value" class="role-option__check">
          <AppIcon name="check" :size="16" label="Seleccionado" />
        </span>
      </label>
    </div>
    <p v-if="error" class="role-selector__error">{{ error }}</p>
  </fieldset>
</template>

<style scoped>
.role-selector {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.role-selector__legend {
  margin-bottom: var(--space-2);
  padding: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-brown);
}

.role-selector__options {
  display: grid;
  gap: var(--space-3);
}

@media (min-width: 480px) {
  .role-selector__options {
    grid-template-columns: 1fr 1fr;
  }
}

.role-option {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  min-height: var(--touch-target);
  padding: var(--space-4);
  background: var(--color-white);
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  color: var(--color-primary);
  cursor: pointer;
}

.role-option:has(:focus-visible) {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

.role-option--selected {
  background: var(--color-surface-soft);
  border-color: var(--color-primary);
}

.role-option__title {
  font-weight: 700;
  color: var(--color-brown);
}

.role-option__description {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.role-option__check {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  display: inline-flex;
  padding: 3px;
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-white);
}

.role-selector__error {
  margin-top: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-error);
}
</style>
