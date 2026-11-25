import { readonly, ref } from 'vue';

const DEFAULT_TIMEOUT_MS = 5000;

const toasts = ref([]);
let nextId = 1;

function dismiss(id) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}

/**
 * Shared toast queue. Render it once with <AppToast />; push from anywhere.
 * @param {'info'|'success'|'error'|'warning'} type
 */
function push(message, { type = 'info', timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const id = nextId++;
  toasts.value = [...toasts.value, { id, message, type }];
  if (timeoutMs > 0) setTimeout(() => dismiss(id), timeoutMs);
  return id;
}

export function useToast() {
  return {
    toasts: readonly(toasts),
    push,
    dismiss,
    info: (message, options) => push(message, { ...options, type: 'info' }),
    success: (message, options) => push(message, { ...options, type: 'success' }),
    warning: (message, options) => push(message, { ...options, type: 'warning' }),
    error: (message, options) => push(message, { ...options, type: 'error' }),
  };
}
