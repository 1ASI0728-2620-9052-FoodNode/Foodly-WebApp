<script setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useChatStore } from '../application/useChatStore.js';
import ChatPanel from './ChatPanel.vue';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';
import AppSkeleton from '../../../shared/ui/AppSkeleton.vue';
import EmptyState from '../../../shared/ui/EmptyState.vue';
import ErrorState from '../../../shared/ui/ErrorState.vue';

const NEW = 'nueva';

const chat = useChatStore();
const route = useRoute();
const router = useRouter();

// /mensajes (list) · /mensajes/nueva (new chat) · /mensajes/:id (conversation).
// Desktop shows list and chat side by side; on mobile each is its own screen.
const param = computed(() => route.params.conversationId ?? null);
const inChat = computed(() => param.value !== null);
const activeId = computed(() => (param.value && param.value !== NEW ? String(param.value) : null));

const dateFormat = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
function conversationLabel(conversation) {
  const date = new Date(conversation.lastMessageAt ?? conversation.startedAt);
  return Number.isNaN(date.getTime()) ? 'Conversación con Lía' : dateFormat.format(date);
}

function onCreated(id) {
  router.replace({ name: 'messages', params: { conversationId: id } });
}

onMounted(() => {
  chat.loadConversations();
  chat.connect();
});
</script>

<template>
  <section class="messages" :class="{ 'messages--chat': inChat }">
    <aside class="messages__list" aria-label="Conversaciones">
      <div class="messages__list-header">
        <h1 class="messages__title">Mensajes</h1>
        <RouterLink
          v-slot="{ navigate }"
          :to="{ name: 'messages', params: { conversationId: NEW } }"
          custom
        >
          <AppButton @click="navigate"><AppIcon name="message" :size="18" /> Nueva</AppButton>
        </RouterLink>
      </div>

      <div
        v-if="chat.loadingConversations && chat.conversations.length === 0"
        role="status"
        aria-busy="true"
      >
        <span class="sr-only">Cargando conversaciones…</span>
        <AppSkeleton v-for="n in 3" :key="n" height="64px" class="messages__skeleton" />
      </div>
      <ErrorState
        v-else-if="chat.conversationsError && chat.conversations.length === 0"
        :message="chat.conversationsError"
        @retry="chat.loadConversations()"
      />
      <EmptyState
        v-else-if="chat.conversations.length === 0"
        icon="message"
        title="Aún no hablas con Lía"
        description="Cuéntale qué se te antoja y te recomienda huariques cerca de ti."
      />
      <ul v-else class="messages__items">
        <li v-for="conversation in chat.sortedConversations" :key="conversation.id">
          <RouterLink
            class="conversation"
            :to="{ name: 'messages', params: { conversationId: conversation.id } }"
            :aria-current="conversation.id === activeId ? 'true' : undefined"
          >
            <span class="conversation__icon" aria-hidden="true"
              ><AppIcon name="message" :size="18"
            /></span>
            <span class="conversation__text">
              <span class="conversation__title">Conversación con Lía</span>
              <span class="conversation__date">{{ conversationLabel(conversation) }}</span>
            </span>
          </RouterLink>
        </li>
      </ul>
    </aside>

    <div class="messages__chat">
      <ChatPanel
        v-if="inChat"
        :key="param"
        :conversation-id="activeId"
        show-back
        @back="router.push({ name: 'messages' })"
        @conversation-created="onCreated"
      />
      <EmptyState
        v-else
        class="messages__placeholder"
        icon="message"
        title="Elige una conversación"
        description="O empieza una nueva para pedirle una recomendación a Lía."
      />
    </div>
  </section>
</template>

<style scoped>
.messages {
  display: grid;
  gap: var(--space-4);
  /* Fill the viewport below the bars so the composer stays reachable. */
  height: calc(100vh - var(--bottombar-height) - var(--space-7));
  min-height: 420px;
}

.messages__list,
.messages__chat {
  min-height: 0;
  overflow: hidden;
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.messages__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  overflow-y: auto;
}

.messages__list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.messages__title {
  font-size: var(--text-2xl);
}

.messages__items {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.messages__skeleton {
  margin-bottom: var(--space-2);
}

.conversation {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--touch-target);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  color: inherit;
  text-decoration: none;
}

.conversation:hover,
.conversation[aria-current='true'] {
  background: var(--color-surface-soft);
}

.conversation__icon {
  display: inline-flex;
  padding: var(--space-2);
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-white);
}

.conversation__text {
  display: flex;
  flex-direction: column;
}

.conversation__title {
  font-weight: 700;
}

.conversation__date {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

/* Mobile: exactly one of the two panes is visible. */
.messages--chat .messages__list {
  display: none;
}
.messages:not(.messages--chat) .messages__chat {
  display: none;
}

@media (min-width: 768px) {
  .messages {
    grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
    height: calc(100vh - var(--topbar-height) - var(--space-8));
  }

  .messages--chat .messages__list,
  .messages:not(.messages--chat) .messages__chat {
    display: flex;
  }

  .messages__placeholder {
    margin: auto;
  }
}
</style>
