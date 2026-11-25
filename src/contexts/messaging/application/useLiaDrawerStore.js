import { ref } from 'vue';
import { defineStore } from 'pinia';

/**
 * State of the "Preguntar a Lía" drawer, opened from the Radar and from a huarique detail.
 * `context` carries what the question is about: the huarique (when there is one) and the
 * coordinates to send along with the message.
 */
export const useLiaDrawerStore = defineStore('lia-drawer', () => {
  const isOpen = ref(false);
  const context = ref({ huariqueId: null, huariqueName: '', location: null });

  function open({ huariqueId = null, huariqueName = '', location = null } = {}) {
    context.value = { huariqueId, huariqueName, location };
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  return { isOpen, context, open, close };
});
