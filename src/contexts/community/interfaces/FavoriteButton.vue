<script setup>
import { computed } from 'vue';
import { useFavoritesStore } from '../application/useFavoritesStore.js';
import AppIcon from '../../../shared/ui/AppIcon.vue';
import { useToast } from '../../../shared/ui/useToast.js';

const props = defineProps({
  huariqueId: { type: String, required: true },
  huariqueName: { type: String, default: '' },
});

const favorites = useFavoritesStore();
const toast = useToast();

const active = computed(() => favorites.isFavorite(props.huariqueId));
const label = computed(() => {
  const target = props.huariqueName ? ` ${props.huariqueName}` : '';
  return active.value ? `Quitar${target} de favoritos` : `Agregar${target} a favoritos`;
});

async function toggle(event) {
  event.stopPropagation(); // do not select the card behind the button
  const ok = await favorites.toggle(props.huariqueId);
  if (!ok) toast.error('No pudimos actualizar tus favoritos. Inténtalo de nuevo.');
}
</script>

<template>
  <button
    type="button"
    class="favorite-button"
    :class="{ 'favorite-button--active': active }"
    :aria-pressed="active"
    :aria-label="label"
    @click="toggle"
  >
    <AppIcon name="heart" :size="22" />
  </button>
</template>

<style scoped>
.favorite-button {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--touch-target);
  height: var(--touch-target);
  background: var(--color-white);
  border: 2px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-primary);
  cursor: pointer;
}

.favorite-button--active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-white);
}

.favorite-button--active :deep(svg) {
  fill: currentcolor;
}
</style>
