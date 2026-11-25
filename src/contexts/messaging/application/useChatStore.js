import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { chatService } from '../infrastructure/ChatService.js';
import { createChatSocket } from '../infrastructure/ChatSocket.js';
import {
  INTENTS,
  LIA_SLOW_NOTICE,
  POLL_INTERVAL_MS,
  POLL_MAX_MS,
  SENDERS,
  matchByName,
  mergeMessages,
  parseRecommendationLines,
  sortConversations,
  toMessage,
  validateOutgoing,
  withHuariqueContext,
} from '../domain/chat.js';
import { useAuthStore } from '../../iam/application/useAuthStore.js';
import { useRadarStore } from '../../radar/application/useRadarStore.js';
import { searchNearby } from '../../radar/application/searchNearby.js';
import { useHuariqueCatalogStore } from '../../business/application/useHuariqueCatalogStore.js';

/** Messages written before the server assigns a conversation live under this key. */
export const NEW_CONVERSATION = 'new';
const SUGGESTION_K_RING = 3;

/**
 * Chat with Lía.
 *
 * Sending is asynchronous: POST /messaging/chat answers 202 and Lía's reply arrives later, over
 * STOMP (/topic/conversations/{id}) or, when the socket is not connected, by polling
 * GET .../messages every 2 s for at most 25 s.
 *
 * The user's message is shown immediately (optimistic, `pending`) and replaced by the server copy
 * when its id comes back. Every source (optimistic, STOMP, polling, history) is merged by message
 * id, so the same message never shows twice.
 */
export const useChatStore = defineStore('chat', () => {
  const conversations = ref([]);
  const loadingConversations = ref(false);
  const conversationsError = ref('');
  const messages = ref({}); // conversationId -> Message[]
  const loadingMessages = ref({}); // conversationId -> boolean
  const thinking = ref({}); // conversationId -> boolean ("Lía está pensando…")
  const connection = ref('disconnected'); // 'connecting' | 'connected' | 'disconnected'
  const suggestions = ref({}); // messageId -> [{ huariqueId, huarique, distanceText }]

  const lastLocation = {}; // conversationId -> { latitude, longitude } (last one sent)
  const unsubscribers = new Map();
  const waiters = new Map(); // conversationId -> { poll, deadline }
  const suggestionRequests = new Map();
  let socket = null;
  let localSeq = 0;

  const sortedConversations = computed(() => sortConversations(conversations.value));
  const messagesOf = (conversationId) => messages.value[conversationId ?? NEW_CONVERSATION] ?? [];
  const isThinking = (conversationId) =>
    Boolean(thinking.value[conversationId ?? NEW_CONVERSATION]);

  // --- socket ---------------------------------------------------------------------------------

  function connect() {
    if (!socket) {
      socket = createChatSocket({
        getToken: () => useAuthStore().token,
        onStateChange: onSocketState,
      });
    }
    socket.connect();
  }

  async function disconnect() {
    waiters.forEach((_w, id) => stopWaiting(id));
    unsubscribers.clear();
    await socket?.disconnect();
    socket = null;
    connection.value = 'disconnected';
  }

  function onSocketState(state) {
    connection.value = state;
    if (state === 'connected') {
      // Replies could have been published while the socket was down: catch up once.
      for (const id of Object.keys(thinking.value)) {
        if (thinking.value[id] && id !== NEW_CONVERSATION) refreshMessages(id);
      }
    } else if (state === 'disconnected') {
      // Whatever is still waiting for Lía falls back to polling.
      for (const [id, waiter] of waiters) if (!waiter.poll) startPolling(id);
    }
  }

  function listen(conversationId) {
    if (!socket || unsubscribers.has(conversationId)) return;
    unsubscribers.set(
      conversationId,
      socket.subscribe(conversationId, (resource) => receive(conversationId, resource)),
    );
  }

  // --- receiving ------------------------------------------------------------------------------

  /** Entry point for every incoming message, whatever its source. */
  function receive(conversationId, resource) {
    const message = toMessage(resource);
    const known = messagesOf(conversationId).some((m) => m.id === message.id);
    messages.value = {
      ...messages.value,
      [conversationId]: mergeMessages(messagesOf(conversationId), [message]),
    };
    if (message.sender === SENDERS.LIA && !known) onLiaReplied(conversationId);
  }

  function onLiaReplied(conversationId) {
    thinking.value = { ...thinking.value, [conversationId]: false };
    stopWaiting(conversationId);
    loadConversations();
  }

  async function refreshMessages(conversationId) {
    const incoming = await chatService.listMessages(conversationId);
    const knownIds = new Set(messagesOf(conversationId).map((m) => m.id));
    const newReply = incoming.some((m) => m.sender === SENDERS.LIA && !knownIds.has(m.id));
    messages.value = {
      ...messages.value,
      [conversationId]: mergeMessages(messagesOf(conversationId), incoming),
    };
    if (newReply) onLiaReplied(conversationId);
  }

  // --- waiting for Lía ------------------------------------------------------------------------

  function startWaiting(conversationId) {
    stopWaiting(conversationId);
    const waiter = { poll: null, deadline: null };
    waiters.set(conversationId, waiter);
    waiter.deadline = setTimeout(() => giveUp(conversationId), POLL_MAX_MS);
    if (connection.value !== 'connected') startPolling(conversationId);
  }

  function startPolling(conversationId) {
    const waiter = waiters.get(conversationId);
    if (!waiter || waiter.poll) return;
    waiter.poll = setInterval(() => {
      refreshMessages(conversationId).catch(() => {
        /* a failed tick is retried on the next one */
      });
    }, POLL_INTERVAL_MS);
  }

  function stopWaiting(conversationId) {
    const waiter = waiters.get(conversationId);
    if (!waiter) return;
    clearInterval(waiter.poll);
    clearTimeout(waiter.deadline);
    waiters.delete(conversationId);
  }

  function giveUp(conversationId) {
    stopWaiting(conversationId);
    if (!thinking.value[conversationId]) return;
    thinking.value = { ...thinking.value, [conversationId]: false };
    messages.value = {
      ...messages.value,
      [conversationId]: mergeMessages(messagesOf(conversationId), [
        {
          id: `notice-${++localSeq}`,
          sender: SENDERS.SYSTEM,
          content: LIA_SLOW_NOTICE,
          intentType: null,
          huariqueId: null,
          reservationId: null,
          sentAt: null,
          pending: false,
          failed: false,
        },
      ]),
    };
  }

  // --- conversations and history --------------------------------------------------------------

  async function loadConversations() {
    loadingConversations.value = true;
    conversationsError.value = '';
    try {
      conversations.value = await chatService.listConversations();
    } catch (cause) {
      conversationsError.value = cause?.message ?? 'No pudimos cargar tus conversaciones.';
    } finally {
      loadingConversations.value = false;
    }
  }

  async function openConversation(conversationId) {
    if (!conversationId || conversationId === NEW_CONVERSATION) return;
    loadingMessages.value = { ...loadingMessages.value, [conversationId]: true };
    try {
      await refreshMessages(conversationId);
    } finally {
      loadingMessages.value = { ...loadingMessages.value, [conversationId]: false };
    }
    connect();
    listen(conversationId);
  }

  // --- sending --------------------------------------------------------------------------------

  /**
   * @param {{ text: string, conversationId?: string|null, huariqueId?: string|null,
   *           location?: { latitude: number, longitude: number }|null }} input
   * @returns {Promise<{ ok: boolean, conversationId?: string, error?: string }>}
   */
  async function sendMessage({ text, conversationId = null, huariqueId = null, location = null }) {
    const invalid = validateOutgoing(text, huariqueId);
    if (invalid) return { ok: false, error: invalid };

    const key = conversationId ?? NEW_CONVERSATION;
    const localId = `local-${++localSeq}`;
    const trimmed = text.trim();
    const content = withHuariqueContext(trimmed, huariqueId);

    // Optimistic: visible at once, replaced by the server copy later.
    messages.value = {
      ...messages.value,
      [key]: mergeMessages(messagesOf(key), [
        {
          id: localId,
          sender: SENDERS.EXPLORER,
          content: trimmed,
          rawContent: content,
          intentType: null,
          huariqueId,
          reservationId: null,
          sentAt: null,
          pending: true,
          failed: false,
        },
      ]),
    };
    thinking.value = { ...thinking.value, [key]: true };
    connect();

    try {
      const ack = await chatService.send({
        content,
        conversationId,
        latitude: location?.latitude,
        longitude: location?.longitude,
      });
      const id = ack.conversationId;

      // Move the optimistic message to its real conversation and give it the server id.
      const sent = messagesOf(key).map((m) =>
        m.id === localId ? { ...m, id: ack.messageId, pending: false } : m,
      );
      const rest = { ...messages.value };
      if (key === NEW_CONVERSATION) delete rest[key];
      messages.value = { ...rest, [id]: mergeMessages(messagesOf(id), sent) };
      thinking.value = { ...thinking.value, [key]: false, [id]: true };
      if (location)
        lastLocation[id] = { latitude: location.latitude, longitude: location.longitude };

      listen(id);
      startWaiting(id);
      // A reply published between the POST and the subscription would be lost: read it back once.
      refreshMessages(id).catch(() => {});
      loadConversations();
      return { ok: true, conversationId: id };
    } catch (cause) {
      messages.value = {
        ...messages.value,
        [key]: messagesOf(key).map((m) =>
          m.id === localId ? { ...m, pending: false, failed: true } : m,
        ),
      };
      thinking.value = { ...thinking.value, [key]: false };
      return { ok: false, error: cause?.message ?? 'No pudimos enviar tu mensaje.' };
    }
  }

  /** Removes a message from the thread (a failed one the user chose to resend). */
  function discardMessage(conversationId, messageId) {
    const key = conversationId ?? NEW_CONVERSATION;
    messages.value = {
      ...messages.value,
      [key]: messagesOf(key).filter((m) => m.id !== messageId),
    };
  }

  // --- Lía's suggested huariques --------------------------------------------------------------

  /**
   * Cards for a Lía message. The API sends one `huariqueId` for inquiries and reservations; for
   * recommendations Lía only writes "1. Name (a 320 m)" lines, so those names are matched against
   * a Radar search around the location the user last shared.
   */
  function resolveSuggestions(conversationId, message) {
    if (suggestions.value[message.id]) return Promise.resolve(suggestions.value[message.id]);
    if (suggestionRequests.has(message.id)) return suggestionRequests.get(message.id);

    const request = loadSuggestions(conversationId, message)
      .catch(() => [])
      .then((items) => {
        suggestions.value = { ...suggestions.value, [message.id]: items };
        return items;
      })
      .finally(() => suggestionRequests.delete(message.id));
    suggestionRequests.set(message.id, request);
    return request;
  }

  async function loadSuggestions(conversationId, message) {
    if (message.sender !== SENDERS.LIA) return [];

    if (message.huariqueId) {
      const huarique = await useHuariqueCatalogStore().get(message.huariqueId);
      return huarique ? [{ huariqueId: huarique.id, huarique, distanceText: null }] : [];
    }
    if (message.intentType !== INTENTS.RECOMMENDATION_REQUEST) return [];

    const parsed = parseRecommendationLines(message.content);
    const location = lastLocation[conversationId] ?? useRadarStore().location;
    if (parsed.length === 0 || !location) return [];

    const { items } = await searchNearby({ ...location, kRing: SUGGESTION_K_RING });
    const distances = new Map(parsed.map((p) => [p.name.toLowerCase(), p.distanceText]));
    return matchByName(parsed, items).map((item) => ({
      huariqueId: item.huariqueId,
      huarique: item.huarique,
      distanceText: distances.get(item.huarique.name.toLowerCase()) ?? null,
    }));
  }

  function reset() {
    waiters.forEach((_w, id) => stopWaiting(id));
    unsubscribers.clear();
    suggestionRequests.clear();
    socket?.disconnect();
    socket = null;
    conversations.value = [];
    messages.value = {};
    thinking.value = {};
    suggestions.value = {};
    connection.value = 'disconnected';
    conversationsError.value = '';
    for (const key of Object.keys(lastLocation)) delete lastLocation[key];
  }

  return {
    conversations,
    sortedConversations,
    loadingConversations,
    conversationsError,
    messages,
    loadingMessages,
    thinking,
    connection,
    suggestions,
    messagesOf,
    isThinking,
    connect,
    disconnect,
    loadConversations,
    openConversation,
    sendMessage,
    discardMessage,
    receive,
    resolveSuggestions,
    reset,
  };
});
