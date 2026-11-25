<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useChatStore } from '../application/useChatStore.js';
import { useRadarStore } from '../../radar/application/useRadarStore.js';
import { MAX_MESSAGE_LENGTH, maxUserTextLength, validateOutgoing } from '../domain/chat.js';
import MessageBubble from './MessageBubble.vue';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';
import AppSkeleton from '../../../shared/ui/AppSkeleton.vue';

const props = defineProps({
  /** null starts a new conversation with Lía. */
  conversationId: { type: String, default: null },
  /** { huariqueId, huariqueName, location } the question is about (drawer opened from a huarique/Radar). */
  context: {
    type: Object,
    default: () => ({ huariqueId: null, huariqueName: '', location: null }),
  },
  showBack: { type: Boolean, default: false },
});

const emit = defineEmits(['back', 'conversation-created']);

const chat = useChatStore();
const radar = useRadarStore();

const draft = ref('');
const sendError = ref('');
const sending = ref(false);
const listEl = ref(null);

const activeId = ref(props.conversationId);
const messages = computed(() => chat.messagesOf(activeId.value));
const thinking = computed(() => chat.isThinking(activeId.value));
const loading = computed(() => Boolean(activeId.value && chat.loadingMessages[activeId.value]));
const limit = computed(() => maxUserTextLength(props.context.huariqueId));
const remaining = computed(() => limit.value - draft.value.length);
const lengthError = computed(() =>
  draft.value.trim() ? validateOutgoing(draft.value, props.context.huariqueId) : '',
);
const location = computed(() => props.context.location ?? radar.location ?? null);

async function scrollToEnd() {
  await nextTick();
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight;
}

async function send(text = draft.value) {
  sendError.value = '';
  const invalid = validateOutgoing(text, props.context.huariqueId);
  if (invalid) {
    sendError.value = invalid;
    return;
  }
  sending.value = true;
  const clean = text;
  draft.value = '';
  const result = await chat.sendMessage({
    text: clean,
    conversationId: activeId.value,
    huariqueId: props.context.huariqueId,
    location: location.value,
  });
  sending.value = false;
  if (!result.ok) {
    sendError.value = result.error;
    return;
  }
  if (result.conversationId !== activeId.value) {
    activeId.value = result.conversationId;
    emit('conversation-created', result.conversationId);
  }
}

function retry(message) {
  // Drop the failed copy and send the same text again.
  chat.discardMessage(activeId.value, message.id);
  send(message.content);
}

function onKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    send();
  }
}

async function open() {
  activeId.value = props.conversationId;
  if (activeId.value) await chat.openConversation(activeId.value);
  else chat.connect();
  scrollToEnd();
}

watch(() => props.conversationId, open);
watch(() => [messages.value.length, thinking.value], scrollToEnd);
onMounted(open);
</script>

<template>
  <section class="chat" aria-label="Chat con Lía">
    <header class="chat__header">
      <button
        v-if="showBack"
        type="button"
        class="chat__back"
        aria-label="Volver a las conversaciones"
        @click="emit('back')"
      >
        <AppIcon name="arrowLeft" :size="20" />
      </button>
      <span class="chat__avatar" aria-hidden="true"><AppIcon name="message" :size="20" /></span>
      <div>
        <h2 class="chat__title">Lía</h2>
        <p class="chat__subtitle">Tu asistente gastronómica</p>
      </div>
    </header>

    <p v-if="chat.connection !== 'connected'" class="chat__connection" role="status">
      <AppIcon name="info" :size="16" />
      Sin conexión en tiempo real: las respuestas se actualizan cada pocos segundos.
    </p>

    <ul ref="listEl" class="chat__messages" role="log" aria-live="polite" aria-label="Mensajes">
      <template v-if="loading && messages.length === 0">
        <li v-for="n in 3" :key="n" class="chat__skeleton"><AppSkeleton height="3rem" /></li>
      </template>
      <li v-else-if="messages.length === 0" class="chat__welcome">
        <p v-if="context.huariqueName">
          Pregúntame lo que quieras sobre <strong>{{ context.huariqueName }}</strong>: la carta, los
          horarios o si puedes reservar.
        </p>
        <p v-else>
          Hola, soy Lía. Cuéntame qué se te antoja, cuánto quieres gastar y dónde estás, y te
          recomiendo huariques. También puedo ayudarte con tu reserva.
        </p>
      </li>
      <MessageBubble
        v-for="message in messages"
        :key="message.id"
        :message="message"
        :conversation-id="activeId"
        :context-huarique-id="context.huariqueId"
        @retry="retry"
      />
      <li v-if="thinking" class="chat__thinking" role="status">
        <span class="chat__dots" aria-hidden="true"><i /><i /><i /></span>
        Lía está pensando…
      </li>
    </ul>

    <form class="chat__composer" @submit.prevent="send()">
      <label class="sr-only" for="chat-input">Escribe tu mensaje para Lía</label>
      <textarea
        id="chat-input"
        v-model="draft"
        class="chat__input"
        rows="2"
        placeholder="Escribe tu mensaje…"
        :maxlength="MAX_MESSAGE_LENGTH"
        :aria-invalid="lengthError || sendError ? 'true' : undefined"
        aria-describedby="chat-counter chat-error"
        @keydown="onKeydown"
      />
      <div class="chat__footer">
        <p
          id="chat-counter"
          class="chat__counter"
          :class="{ 'chat__counter--low': remaining < 50 }"
        >
          {{ draft.length }}/{{ limit }}
        </p>
        <p id="chat-error" class="chat__error" role="alert">{{ sendError || lengthError }}</p>
        <AppButton type="submit" :loading="sending" :disabled="!draft.trim()">
          <AppIcon name="send" :size="18" /> Enviar
        </AppButton>
      </div>
    </form>
  </section>
</template>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--color-bg);
}

.chat__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-white);
  border-bottom: 1px solid var(--color-border);
}

.chat__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-target);
  height: var(--touch-target);
  background: none;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}

.chat__avatar {
  display: inline-flex;
  padding: var(--space-2);
  border-radius: 50%;
  background: var(--color-primary);
  color: var(--color-white);
}

.chat__title {
  font-size: var(--text-lg);
}

.chat__subtitle {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.chat__connection {
  display: flex;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-2) var(--space-4);
  background: var(--color-pending-soft);
  font-size: var(--text-xs);
  color: var(--color-brown);
}

.chat__messages {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-3);
  min-height: 0;
  margin: 0;
  padding: var(--space-4);
  overflow-y: auto;
  list-style: none;
}

.chat__welcome {
  padding: var(--space-4);
  background: var(--color-surface-soft);
  border-radius: var(--radius-lg);
  color: var(--color-brown);
}

.chat__skeleton {
  width: 70%;
}

.chat__thinking {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-muted);
}

.chat__dots {
  display: inline-flex;
  gap: 4px;
}

.chat__dots i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
  animation: chat-dot 1s ease-in-out infinite;
}

.chat__dots i:nth-child(2) {
  animation-delay: 0.15s;
}

.chat__dots i:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes chat-dot {
  0%,
  80%,
  100% {
    opacity: 0.3;
  }
  40% {
    opacity: 1;
  }
}

.chat__composer {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--color-white);
  border-top: 1px solid var(--color-border);
}

.chat__input {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: var(--color-white);
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  resize: none;
}

.chat__input:focus-visible {
  outline: none;
  border-color: var(--color-focus);
  box-shadow: var(--focus-ring);
}

.chat__footer {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.chat__counter {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.chat__counter--low {
  font-weight: 700;
  color: var(--color-error);
}

.chat__error {
  flex: 1;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-error);
}
</style>
