<script setup>
import { nextTick, ref, watch } from 'vue';
import { useLiaDrawerStore } from '../application/useLiaDrawerStore.js';
import { useChatStore } from '../application/useChatStore.js';
import ChatPanel from './ChatPanel.vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';

/** "Preguntar a Lía": slide-over chat available from the Radar and from a huarique detail. */
const drawer = useLiaDrawerStore();
const chat = useChatStore();

const closeButton = ref(null);
const conversationId = ref(null);

function onKeydown(event) {
  if (event.key === 'Escape') drawer.close();
}

watch(
  () => drawer.isOpen,
  async (open) => {
    if (!open) return;
    // Continue the explorer's most recent conversation, as the API does when none is given.
    if (chat.conversations.length === 0) await chat.loadConversations();
    conversationId.value = chat.sortedConversations[0]?.id ?? null;
    await nextTick();
    closeButton.value?.focus();
  },
);
</script>

<template>
  <Teleport to="body">
    <div v-if="drawer.isOpen" class="drawer" @keydown="onKeydown">
      <div class="drawer__backdrop" @click="drawer.close()" />
      <aside class="drawer__panel" role="dialog" aria-modal="true" aria-label="Preguntar a Lía">
        <button
          ref="closeButton"
          type="button"
          class="drawer__close"
          aria-label="Cerrar el chat con Lía"
          @click="drawer.close()"
        >
          <AppIcon name="x" :size="22" />
        </button>
        <ChatPanel
          :key="`${drawer.context.huariqueId}-${conversationId}`"
          :conversation-id="conversationId"
          :context="drawer.context"
          @conversation-created="conversationId = $event"
        />
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.drawer {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-toast) + 10);
}

.drawer__backdrop {
  position: absolute;
  inset: 0;
  background: rgb(73 41 6 / 45%);
}

.drawer__panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(100%, 440px);
  background: var(--color-bg);
  box-shadow: var(--shadow-lg);
}

.drawer__close {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-target);
  height: var(--touch-target);
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  cursor: pointer;
}
</style>
