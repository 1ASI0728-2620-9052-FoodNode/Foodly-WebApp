<script setup>
import { useOwnerHuariqueStore } from '../application/useOwnerHuariqueStore.js';
import AppIcon from '../../../shared/ui/AppIcon.vue';
import { useToast } from '../../../shared/ui/useToast.js';

/** Big Abierto/Cerrado switch (PATCH open-status). The state shown is always the server's. */
const owner = useOwnerHuariqueStore();
const toast = useToast();

async function toggle() {
  const result = await owner.toggleOpen();
  if (!result.ok && !result.conflict) toast.error(result.error);
}
</script>

<template>
  <div class="status-switch" :class="{ 'status-switch--open': owner.isOpen }">
    <div>
      <p id="status-switch-label" class="status-switch__label">Estado de tu huarique</p>
      <p class="status-switch__state">
        <AppIcon :name="owner.isOpen ? 'check' : 'x'" :size="22" />
        {{ owner.isOpen ? 'Abierto Ahora' : 'Cerrado' }}
      </p>
    </div>
    <button
      type="button"
      class="status-switch__toggle"
      role="switch"
      :aria-checked="owner.isOpen"
      aria-labelledby="status-switch-label"
      :disabled="owner.saving"
      @click="toggle"
    >
      <span class="status-switch__knob" aria-hidden="true" />
      <span class="sr-only">{{ owner.isOpen ? 'Cerrar el huarique' : 'Abrir el huarique' }}</span>
    </button>
  </div>
</template>

<style scoped>
.status-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--color-white);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.status-switch--open {
  border-color: var(--color-success);
  background: var(--color-success-soft);
}

.status-switch__label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-muted);
}

.status-switch--open .status-switch__label {
  color: var(--color-success-dark);
}

.status-switch__state {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-2xl);
  font-weight: 800;
  color: var(--color-brown);
}

.status-switch__toggle {
  position: relative;
  flex: none;
  width: 88px;
  height: 48px;
  padding: 0;
  background: var(--color-border-strong);
  border: 0;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background-color 0.2s;
}

.status-switch__toggle[aria-checked='true'] {
  background: var(--color-success);
}

.status-switch__toggle:disabled {
  cursor: progress;
  opacity: 0.6;
}

.status-switch__knob {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 40px;
  height: 40px;
  background: var(--color-white);
  border-radius: 50%;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s;
}

.status-switch__toggle[aria-checked='true'] .status-switch__knob {
  transform: translateX(40px);
}
</style>
