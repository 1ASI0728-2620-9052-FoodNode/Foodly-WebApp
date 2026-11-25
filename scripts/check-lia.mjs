// Manual check of the Lía contract against the real gateway: POST /messaging/chat answers 202, the
// STOMP CONNECT carries the JWT, and the reply (or the RF-15 timeout notice) arrives on
// /topic/conversations/{id}. Usage: node scripts/check-lia.mjs
import { Client } from '@stomp/stompjs';

const GATEWAY = process.env.E2E_GATEWAY_URL ?? 'http://localhost:8000';
const id = Date.now().toString(36);

const register = await fetch(`${GATEWAY}/iam/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: `Lia Check ${id}`,
    email: `e2e-lia-${id}@foodly.test`,
    username: `e2e_lia_${id}`,
    password: `Passw0rd!${id}`,
    role: 'GASTRONOMIC_EXPLORER',
  }),
});
const { token } = await register.json();

const started = Date.now();
const ack = await fetch(`${GATEWAY}/messaging/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    content: 'Quiero un ceviche barato cerca',
    latitude: -12.1219,
    longitude: -77.0297,
  }),
});
const accepted = await ack.json();
console.log(
  'POST /messaging/chat ->',
  ack.status,
  JSON.stringify(accepted),
  `${Date.now() - started} ms`,
);

const wsUrl = GATEWAY.replace(/^http/, 'ws') + '/messaging/ws';
const result = await new Promise((resolve) => {
  const client = new Client({
    brokerURL: wsUrl,
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 0,
    onConnect: () => {
      console.log('STOMP CONNECT ok');
      client.subscribe(`/topic/conversations/${accepted.conversationId}`, (frame) => {
        resolve({ via: 'stomp', body: JSON.parse(frame.body) });
        client.deactivate();
      });
      // Anything published before the subscription is read back from history.
      setTimeout(async () => {
        const r = await fetch(
          `${GATEWAY}/messaging/conversations/${accepted.conversationId}/messages`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const list = await r.json();
        console.log(
          'history after 1 s:',
          list.map((m) => `${m.sender}:${m.intentType ?? '-'}`).join(', '),
        );
      }, 1000);
    },
    onStompError: (frame) => resolve({ via: 'stomp-error', body: frame.headers.message }),
    onWebSocketError: () => resolve({ via: 'ws-error', body: 'could not open the WebSocket' }),
  });
  client.activate();
  setTimeout(() => resolve({ via: 'timeout', body: 'no reply in 40 s' }), 40_000);
});
console.log(
  `reply via ${result.via} after ${Date.now() - started} ms:`,
  JSON.stringify(result.body).slice(0, 400),
);
process.exit(0);
