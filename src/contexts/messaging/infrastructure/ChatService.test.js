import { describe, expect, it, vi } from 'vitest';
import { ChatService } from './ChatService.js';
import { buildSocketUrl, ChatSocket } from './ChatSocket.js';

describe('ChatService', () => {
  it('POST /messaging/chat sends only the fields the API defines', async () => {
    const client = {
      post: vi
        .fn()
        .mockResolvedValue({ conversationId: 'c', messageId: 'm', status: 'PROCESSING' }),
    };
    const ack = await new ChatService(client).send({
      content: 'Hola',
      conversationId: 'c',
      latitude: -12.1,
      longitude: -77,
    });
    expect(client.post).toHaveBeenCalledWith('/messaging/chat', {
      content: 'Hola',
      conversationId: 'c',
      latitude: -12.1,
      longitude: -77,
    });
    expect(ack).toEqual({ conversationId: 'c', messageId: 'm', status: 'PROCESSING' });
  });

  it('omits conversationId and coordinates when unknown (never one without the other)', async () => {
    const client = { post: vi.fn().mockResolvedValue({}) };
    await new ChatService(client).send({ content: 'Hola', latitude: -12.1 });
    expect(client.post.mock.calls[0][1]).toEqual({ content: 'Hola' });
  });

  it('lists conversations and messages from the documented endpoints', async () => {
    const client = {
      get: vi
        .fn()
        .mockResolvedValueOnce([{ id: 'c', status: 'ACTIVE', startedAt: 's', lastMessageAt: 'l' }])
        .mockResolvedValueOnce([
          { id: 'm', sender: 'LIA', content: 'Hola', intentType: null, sentAt: 't' },
        ]),
    };
    const service = new ChatService(client);

    expect(await service.listConversations()).toEqual([
      { id: 'c', status: 'ACTIVE', startedAt: 's', lastMessageAt: 'l' },
    ]);
    expect(client.get).toHaveBeenLastCalledWith('/messaging/conversations/me');
    const [message] = await service.listMessages('c');
    expect(client.get).toHaveBeenLastCalledWith('/messaging/conversations/c/messages');
    expect(message).toMatchObject({ id: 'm', sender: 'LIA', content: 'Hola' });
  });
});

describe('ChatSocket', () => {
  it('builds the ws URL through the gateway', () => {
    expect(buildSocketUrl('', 'http://localhost:5173')).toBe('ws://localhost:5173/messaging/ws');
    expect(buildSocketUrl('', 'https://app.foodly.pe')).toBe('wss://app.foodly.pe/messaging/ws');
    expect(buildSocketUrl('http://localhost:8000/', 'http://x')).toBe(
      'ws://localhost:8000/messaging/ws',
    );
  });

  function setup() {
    let config;
    const client = {
      active: false,
      connected: false,
      activate: vi.fn(() => (client.active = true)),
      deactivate: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
    };
    const states = [];
    const socket = new ChatSocket({
      getToken: () => 'jwt-123',
      onStateChange: (state) => states.push(state),
      createClient: (cfg) => {
        config = cfg;
        client.connectHeaders = {};
        return client;
      },
    });
    return { socket, client, states, config: () => config };
  }

  it('sends the JWT as Authorization: Bearer in the CONNECT frame', () => {
    const { client, config, states } = setup();
    config().beforeConnect(client);
    expect(client.connectHeaders).toEqual({ Authorization: 'Bearer jwt-123' });
    expect(states).toEqual(['connecting']);
  });

  it('subscribes to /topic/conversations/{id} once connected, and again after a reconnect', () => {
    const { socket, client, config } = setup();
    const handler = vi.fn();
    socket.subscribe('conv-1', handler); // before the connection: remembered

    client.connected = true;
    config().onConnect();
    expect(client.subscribe).toHaveBeenCalledWith(
      '/topic/conversations/conv-1',
      expect.any(Function),
    );

    config().onWebSocketClose();
    config().onConnect(); // automatic reconnect
    expect(client.subscribe).toHaveBeenCalledTimes(2);

    const frameHandler = client.subscribe.mock.calls[0][1];
    frameHandler({ body: JSON.stringify({ id: 'm1' }) });
    expect(handler).toHaveBeenCalledWith({ id: 'm1' });
    frameHandler({ body: 'not json' }); // ignored, does not throw
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('reports disconnection on close and on STOMP errors', () => {
    const { config, states } = setup();
    config().onWebSocketClose();
    config().onStompError();
    expect(states).toEqual(['disconnected', 'disconnected']);
  });

  it('connect() activates the client once', () => {
    const { socket, client } = setup();
    socket.connect();
    socket.connect();
    expect(client.activate).toHaveBeenCalledTimes(1);
  });
});
