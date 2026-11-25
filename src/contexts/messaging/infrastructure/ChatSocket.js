import { Client } from '@stomp/stompjs';
import { API_BASE_URL } from '../../../shared/config/index.js';

const WS_PATH = '/messaging/ws';
const TOPIC_PREFIX = '/topic/conversations/';

/**
 * ws(s) URL of the STOMP endpoint, through the gateway. In development the base URL is empty and
 * the Vite proxy (ws: true) forwards the upgrade, so the page origin is used.
 */
export function buildSocketUrl(baseUrl = API_BASE_URL, origin = globalThis.location?.origin ?? '') {
  const base = baseUrl || origin;
  return `${base.replace(/^http/, 'ws').replace(/\/+$/, '')}${WS_PATH}`;
}

/**
 * STOMP over WebSocket to Foodly-Messaging-Service.
 *
 * Auth (StompAuthChannelInterceptor): the JWT goes in the CONNECT frame as the
 * `Authorization: Bearer <token>` header. Only EXPLORER tokens are accepted, and a SUBSCRIBE is
 * allowed only to `/topic/conversations/{id}` of one's own conversations. Clients cannot SEND.
 * The server heartbeats every 10 s.
 *
 * Subscriptions are remembered and restored after an automatic reconnect.
 */
export class ChatSocket {
  /**
   * @param {{ getToken: () => string|null, onStateChange: (state: 'connecting'|'connected'|'disconnected') => void }} options
   */
  constructor({ getToken, onStateChange, createClient = (config) => new Client(config) }) {
    this.getToken = getToken;
    this.onStateChange = onStateChange;
    this.handlers = new Map(); // conversationId -> handler
    this.stompSubscriptions = new Map(); // conversationId -> StompSubscription
    this.client = createClient({
      brokerURL: buildSocketUrl(),
      reconnectDelay: 5000,
      heartbeatIncoming: 10_000,
      heartbeatOutgoing: 10_000,
      beforeConnect: (client) => {
        client.connectHeaders = { Authorization: `Bearer ${this.getToken()}` };
        this.onStateChange('connecting');
      },
      onConnect: () => {
        this.onStateChange('connected');
        this.handlers.forEach((_handler, id) => this.#subscribe(id));
      },
      onWebSocketClose: () => {
        this.stompSubscriptions.clear();
        this.onStateChange('disconnected');
      },
      onStompError: () => this.onStateChange('disconnected'),
    });
  }

  connect() {
    if (!this.client.active) this.client.activate();
  }

  async disconnect() {
    this.handlers.clear();
    this.stompSubscriptions.clear();
    await this.client.deactivate();
  }

  /** @returns {() => void} unsubscribe */
  subscribe(conversationId, handler) {
    this.handlers.set(conversationId, handler);
    if (this.client.connected) this.#subscribe(conversationId);
    return () => {
      this.handlers.delete(conversationId);
      this.stompSubscriptions.get(conversationId)?.unsubscribe();
      this.stompSubscriptions.delete(conversationId);
    };
  }

  #subscribe(conversationId) {
    if (this.stompSubscriptions.has(conversationId)) return;
    const subscription = this.client.subscribe(`${TOPIC_PREFIX}${conversationId}`, (frame) => {
      try {
        this.handlers.get(conversationId)?.(JSON.parse(frame.body));
      } catch {
        /* malformed frame: ignore, polling or history will recover it */
      }
    });
    this.stompSubscriptions.set(conversationId, subscription);
  }
}

export function createChatSocket(options) {
  return new ChatSocket(options);
}
