import { httpClient as defaultClient } from '../../../shared/http/index.js';
import { toMessage } from '../domain/chat.js';

/** Every HTTP call to Foodly-Messaging-Service (through Kong, prefix /messaging). Explorer role only. */
export class ChatService {
  constructor(client = defaultClient) {
    this.client = client;
  }

  /** GET /messaging/conversations/me -> [{ id, status, startedAt, lastMessageAt }] */
  async listConversations() {
    const data = await this.client.get('/messaging/conversations/me');
    return (data ?? []).map((c) => ({
      id: c.id,
      status: c.status,
      startedAt: c.startedAt,
      lastMessageAt: c.lastMessageAt,
    }));
  }

  /** GET /messaging/conversations/{id}/messages -> messages, oldest first */
  async listMessages(conversationId) {
    const data = await this.client.get(
      `/messaging/conversations/${encodeURIComponent(conversationId)}/messages`,
    );
    return (data ?? []).map(toMessage);
  }

  /**
   * POST /messaging/chat -> 202 { conversationId, messageId, status: 'PROCESSING' }
   * Lía's answer is NOT in this response: it arrives over STOMP or via listMessages.
   * Latitude and longitude must go together; they are omitted when unknown.
   */
  async send({ content, conversationId, latitude, longitude }) {
    const body = { content };
    if (conversationId) body.conversationId = conversationId;
    if (latitude != null && longitude != null) {
      body.latitude = latitude;
      body.longitude = longitude;
    }
    const data = await this.client.post('/messaging/chat', body);
    return {
      conversationId: data.conversationId,
      messageId: data.messageId,
      status: data.status,
    };
  }
}

export const chatService = new ChatService();
