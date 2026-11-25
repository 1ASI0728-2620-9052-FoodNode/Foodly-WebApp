<script setup>
import AppIcon from './AppIcon.vue';
import { useToast } from './useToast.js';

const { toasts, dismiss } = useToast();

const ICON_BY_TYPE = { info: 'info', success: 'check', warning: 'alert', error: 'alert' };
</script>

<template>
  <div class="app-toast-region" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="app-toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="app-toast"
        :class="`app-toast--${toast.type}`"
        :role="toast.type === 'error' ? 'alert' : 'status'"
      >
        <AppIcon :name="ICON_BY_TYPE[toast.type]" :size="20" />
        <p class="app-toast__message">{{ toast.message }}</p>
        <button
          type="button"
          class="app-toast__close"
          aria-label="Cerrar notificación"
          @click="dismiss(toast.id)"
        >
          <AppIcon name="x" :size="18" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.app-toast-region {
  position: fixed;
  right: var(--space-4);
  bottom: calc(var(--bottombar-height) + var(--space-4));
  left: var(--space-4);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-3);
  pointer-events: none;
}

@media (min-width: 768px) {
  .app-toast-region {
    bottom: var(--space-5);
    left: auto;
    max-width: 420px;
  }
}

.app-toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-left-width: 6px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
}

.app-toast__message {
  flex: 1;
  padding-top: 2px;
  font-size: var(--text-sm);
}

.app-toast__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-target);
  height: var(--touch-target);
  margin: calc(var(--space-3) * -1) 0;
  background: none;
  border: 0;
  border-radius: 50%;
  color: var(--color-text-muted);
  cursor: pointer;
}

.app-toast--info {
  border-left-color: var(--color-primary);
}
.app-toast--success {
  border-left-color: var(--color-success);
}
.app-toast--warning {
  border-left-color: var(--color-pending);
}
.app-toast--error {
  border-left-color: var(--color-error);
}

.app-toast-enter-active,
.app-toast-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}
.app-toast-enter-from,
.app-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
