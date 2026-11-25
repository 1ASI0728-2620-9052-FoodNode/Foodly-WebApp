<script>
/** Status vocabulary of the product. Every badge shows text AND an icon, never color alone. */
export const BADGE_STATUSES = Object.freeze({
  open: { label: 'Abierto Ahora', icon: 'check', tone: 'success' },
  closed: { label: 'Cerrado', icon: 'x', tone: 'neutral' },
  pending: { label: 'Pendiente', icon: 'clock', tone: 'pending' },
  approved: { label: 'Aprobada', icon: 'check', tone: 'success' },
  rejected: { label: 'Rechazada', icon: 'x', tone: 'error' },
  expired: { label: 'Expirada', icon: 'alert', tone: 'neutral' },
  verified: { label: 'Reserva Verificada', icon: 'shieldCheck', tone: 'success' },
});
</script>

<script setup>
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps({
  status: { type: String, required: true, validator: (value) => value in BADGE_STATUSES },
});

const config = computed(() => BADGE_STATUSES[props.status]);
</script>

<template>
  <span class="status-badge" :class="`status-badge--${config.tone}`">
    <AppIcon :name="config.icon" :size="16" />
    {{ config.label }}
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
}

/* Text colors are the dark variants so every pair stays above 4.5:1. */
.status-badge--success {
  background: var(--color-success-soft);
  color: var(--color-success-dark);
}

.status-badge--pending {
  background: var(--color-pending-soft);
  color: var(--color-brown);
}
.status-badge--pending :deep(svg) {
  color: var(--color-primary);
}

.status-badge--error {
  background: var(--color-error-soft);
  color: var(--color-error);
}

.status-badge--neutral {
  background: var(--color-surface-soft);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}
</style>
