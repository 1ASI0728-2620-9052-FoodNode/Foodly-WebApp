import { onBeforeUnmount, onMounted, toValue } from 'vue';

/**
 * Runs `callback` every `intervalMs` while the component is mounted and `enabled` is true.
 * Used to pick up reservation approvals made from another tab or by the owner.
 */
export function usePolling(callback, intervalMs, enabled = true) {
  let timer = null;
  onMounted(() => {
    timer = setInterval(() => {
      if (toValue(enabled)) callback();
    }, intervalMs);
  });
  onBeforeUnmount(() => clearInterval(timer));
}
