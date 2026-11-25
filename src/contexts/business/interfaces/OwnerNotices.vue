<script setup>
import { VISIBILITY_MESSAGE, useOwnerHuariqueStore } from '../application/useOwnerHuariqueStore.js';
import AppIcon from '../../../shared/ui/AppIcon.vue';

/** Banners shared by the owner screens: "visible in the Radar" (RNF-08) and version conflicts. */
const owner = useOwnerHuariqueStore();
</script>

<template>
  <div class="notices">
    <p v-if="owner.conflictNotice" class="notice notice--conflict" role="alert">
      <AppIcon name="alert" :size="20" />
      <span>{{ owner.conflictNotice }}</span>
      <button
        type="button"
        class="notice__close"
        aria-label="Cerrar aviso"
        @click="owner.dismissConflict()"
      >
        <AppIcon name="x" :size="18" />
      </button>
    </p>
    <p v-if="owner.visibilityNotice" class="notice notice--ok" role="status">
      <AppIcon name="check" :size="20" />
      <span>{{ VISIBILITY_MESSAGE }}</span>
    </p>
  </div>
</template>

<style scoped>
.notices {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.notices:empty {
  display: none;
}

.notice {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
}

.notice span {
  flex: 1;
}

.notice--conflict {
  background: var(--color-pending-soft);
  border: 1px solid var(--color-pending);
  color: var(--color-brown);
}

.notice--ok {
  background: var(--color-success-soft);
  color: var(--color-success-dark);
}

.notice__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-target);
  height: var(--touch-target);
  margin: calc(var(--space-3) * -1);
  background: none;
  border: 0;
  cursor: pointer;
}
</style>
