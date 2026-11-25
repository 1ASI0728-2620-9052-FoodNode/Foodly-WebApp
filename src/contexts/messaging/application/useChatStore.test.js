import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const socketState = vi.hoisted(() => ({ options: null, handlers: new Map(), instance: null }));

vi.mock('../infrastructure/ChatService.js', () => ({
  chatService: { listConversations: vi.fn(), listMessages: vi.fn(), send: vi.fn() },
}));
vi.mock('../infrastructure/ChatSocket.js', () => ({
  createChatSocket: (options) => {
    socketState.options = options;
    socketState.instance = {
      connect: vi.fn(),
      disconnect: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn((id, handler) => {
        socketState.handlers.set(id, handler);
        return () => socketState.handlers.delete(id);
      }),
    };
    return socketState.instance;
  },
}));
vi.mock('../../radar/application/searchNearby.js', () => ({ searchNearby: vi.fn() }));
vi.mock('../../business/infrastructure/BusinessService.js', () => ({
  businessService: { getHuarique: vi.fn(), getMenu: vi.fn() },
}));

import { chatService } from '../infrastructure/ChatService.js';
import { searchNearby } from '../../radar/application/searchNearby.js';
import { businessService } from '../../business/infrastructure/BusinessService.js';
import { NEW_CONVERSATION, useChatStore } from './useChatStore.js';
import {
  LIA_SLOW_NOTICE,
  MAX_MESSAGE_LENGTH,
  POLL_INTERVAL_MS,
  POLL_MAX_MS,
} from '../domain/chat.js';

const CONV = '5b0d3e8a-6f43-4a0e-9d38-2d7b1c4f9a10';
const HUARIQUE = '65f1c2a9-e4b0-4a1d-8c3f-4a5b6c7d8e9f';

const explorerMsg = (id, content = 'Quiero ceviche') => ({
  id,
  sender: 'EXPLORER',
  content,
  intentType: null,
  huariqueId: null,
  reservationId: null,
  sentAt: '2026-11-24T15:00:00',
});
const liaMsg = (id, extra = {}) => ({
  id,
  sender: 'LIA',
  content: 'Esto es lo que encontré',
  intentType: 'RECOMMENDATION_REQUEST',
  huariqueId: null,
  reservationId: null,
  sentAt: '2026-11-24T15:00:03',
  ...extra,
});
const parsed = (resource) => ({
  ...resource,
  rawContent: resource.content,
  pending: false,
  failed: false,
});
const ack = (messageId = 'm-1', conversationId = CONV) => ({
  conversationId,
  messageId,
  status: 'PROCESSING',
});

describe('useChatStore', () => {
  let chat;

  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    for (const fn of [chatService.listConversations, chatService.listMessages, chatService.send]) {
      fn.mockReset();
    }
    chatService.listConversations.mockResolvedValue([]);
    chatService.listMessages.mockResolvedValue([]);
    socketState.handlers.clear();
    chat = useChatStore();
  });

  afterEach(() => {
    chat.reset();
    vi.useRealTimers();
  });

  describe('sending (optimistic update)', () => {
    it('shows the user message immediately, with "Lía está pensando…", before the server answers', async () => {
      let release;
      chatService.send.mockImplementation(
        () => new Promise((resolve) => (release = () => resolve(ack()))),
      );

      const pending = chat.sendMessage({ text: ' Quiero ceviche ' });

      const [message] = chat.messagesOf(NEW_CONVERSATION);
      expect(message).toMatchObject({
        sender: 'EXPLORER',
        content: 'Quiero ceviche',
        pending: true,
      });
      expect(chat.isThinking(NEW_CONVERSATION)).toBe(true);

      release();
      await pending;
    });

    it('moves the message to the real conversation and adopts the server message id', async () => {
      chatService.send.mockResolvedValue(ack('server-msg'));

      const result = await chat.sendMessage({ text: 'Hola' });

      expect(result).toEqual({ ok: true, conversationId: CONV });
      expect(chat.messagesOf(NEW_CONVERSATION)).toEqual([]);
      expect(chat.messagesOf(CONV)).toHaveLength(1);
      expect(chat.messagesOf(CONV)[0]).toMatchObject({ id: 'server-msg', pending: false });
      expect(chat.isThinking(CONV)).toBe(true);
      expect(chat.isThinking(NEW_CONVERSATION)).toBe(false);
    });

    it('sends content, conversation and coordinates together (and omits them when unknown)', async () => {
      chatService.send.mockResolvedValue(ack());
      await chat.sendMessage({
        text: 'Hola',
        conversationId: CONV,
        location: { latitude: -12.12, longitude: -77.03 },
      });
      expect(chatService.send).toHaveBeenLastCalledWith({
        content: 'Hola',
        conversationId: CONV,
        latitude: -12.12,
        longitude: -77.03,
      });
    });

    it('carries the huariqueId as a prefix of the sent text but shows only the user text', async () => {
      chatService.send.mockResolvedValue(ack());
      await chat.sendMessage({ text: '¿Tienen carta vegana?', huariqueId: HUARIQUE });

      expect(chatService.send.mock.calls[0][0].content).toBe(
        `[huarique:${HUARIQUE}] ¿Tienen carta vegana?`,
      );
      expect(chat.messagesOf(CONV)[0].content).toBe('¿Tienen carta vegana?');
    });

    it('marks the message as failed (not lost) when the POST fails', async () => {
      chatService.send.mockRejectedValue({ status: 500, message: 'Servicio caído' });

      const result = await chat.sendMessage({ text: 'Hola' });

      expect(result).toEqual({ ok: false, error: 'Servicio caído' });
      expect(chat.messagesOf(NEW_CONVERSATION)[0]).toMatchObject({ failed: true, pending: false });
      expect(chat.isThinking(NEW_CONVERSATION)).toBe(false);
    });
  });

  describe('1000 character limit', () => {
    it('accepts exactly 1000 characters', async () => {
      chatService.send.mockResolvedValue(ack());
      const result = await chat.sendMessage({ text: 'a'.repeat(MAX_MESSAGE_LENGTH) });
      expect(result.ok).toBe(true);
    });

    it('rejects 1001 characters without calling the API or showing a bubble', async () => {
      const result = await chat.sendMessage({ text: 'a'.repeat(MAX_MESSAGE_LENGTH + 1) });
      expect(result.ok).toBe(false);
      expect(chatService.send).not.toHaveBeenCalled();
      expect(chat.messagesOf(NEW_CONVERSATION)).toEqual([]);
    });

    it('counts the huarique prefix inside the 1000 characters', async () => {
      const result = await chat.sendMessage({
        text: 'a'.repeat(MAX_MESSAGE_LENGTH),
        huariqueId: HUARIQUE,
      });
      expect(result.ok).toBe(false);
    });

    it('rejects blank text', async () => {
      expect((await chat.sendMessage({ text: '   ' })).ok).toBe(false);
    });
  });

  describe('deduplication by messageId between WebSocket and polling', () => {
    beforeEach(async () => {
      chat.connect();
      socketState.options.onStateChange('connected');
      chatService.send.mockResolvedValue(ack('m-user'));
      await chat.sendMessage({ text: 'Quiero ceviche' });
      await vi.advanceTimersByTimeAsync(0);
    });

    it('subscribes to /topic/conversations/{id} (through the socket) for the new conversation', () => {
      expect(socketState.handlers.has(CONV)).toBe(true);
    });

    it('shows a reply delivered over WebSocket once, and clears "pensando"', () => {
      socketState.handlers.get(CONV)(liaMsg('m-lia'));

      expect(chat.messagesOf(CONV).filter((m) => m.sender === 'LIA')).toHaveLength(1);
      expect(chat.isThinking(CONV)).toBe(false);
    });

    it('does not duplicate the same reply when it arrives again through polling/history', async () => {
      socketState.handlers.get(CONV)(liaMsg('m-lia'));
      chatService.listMessages.mockResolvedValue([
        parsed(explorerMsg('m-user')),
        parsed(liaMsg('m-lia')),
      ]);

      await chat.openConversation(CONV);

      expect(chat.messagesOf(CONV).map((m) => m.id)).toEqual(['m-user', 'm-lia']);
    });

    it('does not duplicate the same reply delivered twice over the socket', () => {
      socketState.handlers.get(CONV)(liaMsg('m-lia'));
      socketState.handlers.get(CONV)(liaMsg('m-lia'));
      expect(chat.messagesOf(CONV).filter((m) => m.id === 'm-lia')).toHaveLength(1);
    });

    it('replaces the optimistic copy with the server copy instead of showing both', async () => {
      chatService.listMessages.mockResolvedValue([parsed(explorerMsg('m-user'))]);
      await chat.openConversation(CONV);
      const mine = chat.messagesOf(CONV).filter((m) => m.sender === 'EXPLORER');
      expect(mine).toHaveLength(1);
      expect(mine[0].sentAt).toBe('2026-11-24T15:00:00');
    });
  });

  describe('polling fallback when the socket does not connect', () => {
    it('polls GET .../messages every 2 s until Lía answers, then stops', async () => {
      chatService.send.mockResolvedValue(ack('m-user'));
      chatService.listMessages.mockResolvedValue([parsed(explorerMsg('m-user'))]);
      await chat.sendMessage({ text: 'Hola' }); // socket never reaches "connected"
      chatService.listMessages.mockClear();

      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      expect(chatService.listMessages).toHaveBeenCalledTimes(2);
      expect(chatService.listMessages).toHaveBeenCalledWith(CONV);
      expect(chat.isThinking(CONV)).toBe(true);

      chatService.listMessages.mockResolvedValue([
        parsed(explorerMsg('m-user')),
        parsed(liaMsg('m-lia')),
      ]);
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(chat.messagesOf(CONV).map((m) => m.id)).toEqual(['m-user', 'm-lia']);
      expect(chat.isThinking(CONV)).toBe(false);

      chatService.listMessages.mockClear();
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
      expect(chatService.listMessages).not.toHaveBeenCalled();
    });

    it('gives up after 25 s with a notice that offers manual reservation', async () => {
      chatService.send.mockResolvedValue(ack('m-user'));
      chatService.listMessages.mockResolvedValue([parsed(explorerMsg('m-user'))]);
      await chat.sendMessage({ text: 'Hola' });

      await vi.advanceTimersByTimeAsync(POLL_MAX_MS + 1);

      expect(chat.isThinking(CONV)).toBe(false);
      const notice = chat.messagesOf(CONV).at(-1);
      expect(notice).toMatchObject({ sender: 'SYSTEM', content: LIA_SLOW_NOTICE });

      chatService.listMessages.mockClear();
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
      expect(chatService.listMessages).not.toHaveBeenCalled(); // polling stopped
    });

    it('tolerates a failing poll tick and keeps trying', async () => {
      chatService.send.mockResolvedValue(ack('m-user'));
      chatService.listMessages.mockResolvedValue([parsed(explorerMsg('m-user'))]);
      await chat.sendMessage({ text: 'Hola' });

      chatService.listMessages.mockRejectedValueOnce({ status: 500 });
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
      chatService.listMessages.mockResolvedValue([
        parsed(explorerMsg('m-user')),
        parsed(liaMsg('m-lia')),
      ]);
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(chat.isThinking(CONV)).toBe(false);
    });

    it('does not poll while the socket is connected', async () => {
      chat.connect();
      socketState.options.onStateChange('connected');
      chatService.send.mockResolvedValue(ack('m-user'));
      await chat.sendMessage({ text: 'Hola' });
      chatService.listMessages.mockClear();

      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);

      expect(chatService.listMessages).not.toHaveBeenCalled();
    });

    it('switches to polling if the socket drops while waiting', async () => {
      chat.connect();
      socketState.options.onStateChange('connected');
      chatService.send.mockResolvedValue(ack('m-user'));
      chatService.listMessages.mockResolvedValue([parsed(explorerMsg('m-user'))]);
      await chat.sendMessage({ text: 'Hola' });
      chatService.listMessages.mockClear();

      socketState.options.onStateChange('disconnected');
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

      expect(chatService.listMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe("Lía's suggested huariques", () => {
    const recommendation = liaMsg('m-lia', {
      content:
        'Esto es lo que encontré cerca de ti:\n1. Cevichería Don Pepe (a 320 m)\n2. Chifa Wong (a 1.4 km)',
    });
    const huarique = (id, name) => ({ id, name, tags: [], isOpen: true });

    it('turns a recommendation into cards by matching names against a Radar search', async () => {
      chatService.send.mockResolvedValue(ack());
      await chat.sendMessage({
        text: 'ceviche',
        location: { latitude: -12.12, longitude: -77.03 },
      });
      searchNearby.mockResolvedValue({
        items: [
          { huariqueId: 'h1', huarique: huarique('h1', 'Cevichería Don Pepe') },
          { huariqueId: 'h2', huarique: huarique('h2', 'Chifa Wong') },
          { huariqueId: 'h3', huarique: huarique('h3', 'Otro lugar') },
        ],
      });

      const cards = await chat.resolveSuggestions(CONV, parsed(recommendation));

      expect(searchNearby).toHaveBeenCalledWith({ latitude: -12.12, longitude: -77.03, kRing: 3 });
      expect(cards.map((c) => [c.huariqueId, c.distanceText])).toEqual([
        ['h1', '320 m'],
        ['h2', '1.4 km'],
      ]);
    });

    it('uses the huariqueId of the message when there is one', async () => {
      businessService.getHuarique.mockResolvedValue(huarique(HUARIQUE, 'Don Pepe'));
      const message = parsed(
        liaMsg('m-info', { intentType: 'HUARIQUE_INQUIRY', huariqueId: HUARIQUE }),
      );

      const cards = await chat.resolveSuggestions(CONV, message);

      expect(cards).toHaveLength(1);
      expect(cards[0].huarique.name).toBe('Don Pepe');
    });

    it('returns no cards (and no error) when Radar fails or the location is unknown', async () => {
      expect(await chat.resolveSuggestions(CONV, parsed(recommendation))).toEqual([]);
      expect(searchNearby).not.toHaveBeenCalled();
    });

    it('resolves each message only once', async () => {
      businessService.getHuarique.mockResolvedValue(huarique(HUARIQUE, 'Don Pepe'));
      const message = parsed(liaMsg('m-info', { huariqueId: HUARIQUE }));
      await Promise.all([
        chat.resolveSuggestions(CONV, message),
        chat.resolveSuggestions(CONV, message),
      ]);
      await chat.resolveSuggestions(CONV, message);
      expect(businessService.getHuarique).toHaveBeenCalledTimes(1);
    });
  });

  it('loads and sorts conversations by last activity', async () => {
    chatService.listConversations.mockResolvedValue([
      {
        id: 'a',
        status: 'ACTIVE',
        startedAt: '2026-11-20T10:00:00',
        lastMessageAt: '2026-11-20T10:05:00',
      },
      {
        id: 'b',
        status: 'ACTIVE',
        startedAt: '2026-11-24T09:00:00',
        lastMessageAt: '2026-11-24T09:30:00',
      },
    ]);
    await chat.loadConversations();
    expect(chat.sortedConversations.map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('reports a conversations error', async () => {
    chatService.listConversations.mockRejectedValue({ message: 'Servicio caído' });
    await chat.loadConversations();
    expect(chat.conversationsError).toBe('Servicio caído');
  });
});
