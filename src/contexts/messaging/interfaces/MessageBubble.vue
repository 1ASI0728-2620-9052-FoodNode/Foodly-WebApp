<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useChatStore } from '../application/useChatStore.js';
import { INTENTS, SENDERS, offersManualReservation } from '../domain/chat.js';
import SuggestedHuariques from './SuggestedHuariques.vue';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';

const props = defineProps({
  message: { type: Object, required: true },
  conversationId: { type: String, default: null },
  /** Huarique the conversation is about, used when the message itself names none. */
  contextHuariqueId: { type: String, default: null },
});

const emit = defineEmits(['retry']);

const chat = useChatStore();

const isMine = computed(() => props.message.sender === SENDERS.EXPLORER);
const isSystem = computed(() => props.message.sender === SENDERS.SYSTEM);
const isLia = computed(() => props.message.sender === SENDERS.LIA);

const targetHuariqueId = computed(() => props.message.huariqueId ?? props.contextHuariqueId);
const showManualReservation = computed(() => offersManualReservation(props.message));
const showConfirmReservation = computed(
  () =>
    isLia.value &&
    props.message.intentType === INTENTS.RESERVATION_REQUEST &&
    props.message.huariqueId &&
    !props.message.reservationId,
);

const suggested = ref([]);
async function loadSuggestions() {
  if (!isLia.value || !props.conversationId) return;
  suggested.value = await chat.resolveSuggestions(props.conversationId, props.message);
}
onMounted(loadSuggestions);
watch(() => props.message.id, loadSuggestions);
</script>

<template>
  <li
    class="bubble"
    :class="{
      'bubble--mine': isMine,
      'bubble--lia': isLia,
      'bubble--system': isSystem,
      'bubble--failed': message.failed,
    }"
  >
    <p class="bubble__author">{{ isMine ? 'Tú' : isLia ? 'Lía' : 'Foodly' }}</p>
    <p class="bubble__content">{{ message.content }}</p>

    <p v-if="message.pending" class="bubble__state">Enviando…</p>
    <p v-if="message.failed" class="bubble__state bubble__state--error" role="alert">
      <AppIcon name="alert" :size="16" /> No se envió.
      <button type="button" class="bubble__retry" @click="emit('retry', message)">
        Reintentar
      </button>
    </p>

    <SuggestedHuariques v-if="suggested.length" :items="suggested" />

    <div
      v-if="showConfirmReservation || showManualReservation || message.reservationId"
      class="bubble__actions"
    >
      <RouterLink
        v-if="message.reservationId"
        v-slot="{ navigate }"
        :to="{ name: 'reservation-detail', params: { id: message.reservationId } }"
        custom
      >
        <AppButton variant="success" @click="navigate">Ver mi reserva</AppButton>
      </RouterLink>
      <RouterLink
        v-else-if="showConfirmReservation"
        v-slot="{ navigate }"
        :to="{ name: 'reserve', params: { id: message.huariqueId }, query: { from: 'lia' } }"
        custom
      >
        <AppButton @click="navigate">Confirmar datos de la reserva</AppButton>
      </RouterLink>
      <RouterLink
        v-if="showManualReservation"
        v-slot="{ navigate }"
        :to="
          targetHuariqueId
            ? { name: 'reserve', params: { id: targetHuariqueId } }
            : { name: 'radar' }
        "
        custom
      >
        <AppButton variant="secondary" @click="navigate">
          {{ targetHuariqueId ? 'Reservar manualmente' : 'Elegir un huarique para reservar' }}
        </AppButton>
      </RouterLink>
    </div>
  </li>
</template>

<style scoped>
.bubble {
  align-self: flex-start;
  max-width: min(85%, 560px);
  padding: var(--space-3) var(--space-4);
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--space-1);
  list-style: none;
}

.bubble--mine {
  align-self: flex-end;
  background: var(--color-primary);
  border-color: var(--color-primary);
  border-radius: var(--radius-lg) var(--radius-lg) var(--space-1) var(--radius-lg);
  color: var(--color-white);
}

.bubble--system {
  align-self: center;
  background: var(--color-pending-soft);
  border-color: var(--color-pending);
  color: var(--color-brown);
}

.bubble--failed {
  opacity: 0.85;
}

.bubble__author {
  margin-bottom: 2px;
  font-size: var(--text-xs);
  font-weight: 700;
  opacity: 0.85;
}

.bubble__content {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.bubble__state {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-1);
  font-size: var(--text-xs);
}

.bubble__state--error {
  font-weight: 700;
}

.bubble--mine .bubble__state--error {
  color: var(--color-white);
}

.bubble__retry {
  min-height: var(--touch-target);
  padding: 0 var(--space-2);
  background: none;
  border: 0;
  font-weight: 700;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.bubble__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
</style>
