import { normalizeText } from '../../../shared/geo/districts.js';

/** Foodly-Messaging-Service contract (SendMessageResource / MessageResource / ConversationResource). */
export const MAX_MESSAGE_LENGTH = 1000;

export const SENDERS = Object.freeze({ EXPLORER: 'EXPLORER', LIA: 'LIA', SYSTEM: 'SYSTEM' });

export const INTENTS = Object.freeze({
  RECOMMENDATION_REQUEST: 'RECOMMENDATION_REQUEST',
  HUARIQUE_INQUIRY: 'HUARIQUE_INQUIRY',
  RESERVATION_REQUEST: 'RESERVATION_REQUEST',
  UNKNOWN: 'UNKNOWN',
});

/** Waiting for Lía: poll every 2 s, give up after 25 s. */
export const POLL_INTERVAL_MS = 2000;
export const POLL_MAX_MS = 25_000;

/**
 * The chat API has no `huariqueId` field. When the user asks about a huarique, the id travels as a
 * `[huarique:<uuid>]` prefix of the text so Lía's intent extraction can pick it up. It is stripped
 * for display.
 */
const CONTEXT_PATTERN = /^\[huarique:([0-9a-fA-F-]{36})\]\s*/;

export function withHuariqueContext(text, huariqueId) {
  return huariqueId ? `[huarique:${huariqueId}] ${text}` : text;
}

export function parseContext(content) {
  const match = CONTEXT_PATTERN.exec(content ?? '');
  return match
    ? { huariqueId: match[1], text: content.slice(match[0].length) }
    : { huariqueId: null, text: content ?? '' };
}

/** Characters left for the user's own text once the huarique prefix is accounted for. */
export function maxUserTextLength(huariqueId) {
  return MAX_MESSAGE_LENGTH - withHuariqueContext('', huariqueId).length;
}

/** @returns {string} error message in Spanish, or '' when the text can be sent */
export function validateOutgoing(text, huariqueId = null) {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return 'Escribe un mensaje.';
  if (trimmed.length > maxUserTextLength(huariqueId)) {
    return `El mensaje admite hasta ${maxUserTextLength(huariqueId)} caracteres.`;
  }
  return '';
}

/** @param {object} resource MessageResource, from REST or from the STOMP topic */
export function toMessage(resource) {
  const { huariqueId: contextId, text } = parseContext(resource.content);
  return {
    id: resource.id,
    sender: resource.sender,
    content: text,
    rawContent: resource.content,
    intentType: resource.intentType ?? null,
    huariqueId: resource.huariqueId ?? contextId,
    reservationId: resource.reservationId ?? null,
    sentAt: resource.sentAt ?? null,
    pending: false,
    failed: false,
  };
}

/**
 * Lía closes timeouts, provider failures and rejected reservations offering to book by hand
 * (RF-15). The API sends no flag, only that sentence, so the text is the signal.
 */
const MANUAL_RESERVATION_PATTERN = /reserva de forma manual/i;

export function offersManualReservation(message) {
  return message.sender !== SENDERS.EXPLORER && MANUAL_RESERVATION_PATTERN.test(message.content);
}

/** Text of the notice shown when Lía does not answer within the 25 s of polling. */
export const LIA_SLOW_NOTICE =
  'Lía está tardando más de lo esperado. Puedes volver a escribirle en unos minutos o hacer tu reserva de forma manual desde la ficha del huarique.';

/**
 * Lía lists recommendations as "1. Name (a 320 m)" lines and sends no ids with them.
 * @returns {{ name: string, distanceText: string }[]}
 */
export function parseRecommendationLines(content) {
  const found = [];
  for (const line of (content ?? '').split('\n')) {
    const match = /^\s*\d+\.\s+(.+?)\s+\(a\s+([^)]+)\)\s*$/.exec(line);
    if (match) found.push({ name: match[1].trim(), distanceText: match[2].trim() });
  }
  return found;
}

/** Matches parsed names against known huariques (accent/case insensitive, exact name). */
export function matchByName(parsed, candidates) {
  const byName = new Map(candidates.map((c) => [normalizeText(c.huarique.name), c]));
  return parsed
    .map(({ name }) => byName.get(normalizeText(name)))
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index);
}

export function sortConversations(conversations) {
  return [...conversations].sort((a, b) =>
    String(b.lastMessageAt ?? b.startedAt).localeCompare(String(a.lastMessageAt ?? a.startedAt)),
  );
}

const sortKey = (message) => (message.sentAt ? Date.parse(message.sentAt) || Infinity : Infinity);

/**
 * Merges messages by id (WebSocket, polling and optimistic copies can all describe the same one).
 * An incoming message replaces the stored one with the same id. Order is by `sentAt`; messages
 * without it yet (just sent, awaiting the server copy) go last, in arrival order.
 */
export function mergeMessages(existing, incoming) {
  const byId = new Map(existing.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()]
    .map((message, index) => ({ message, index }))
    .sort((a, b) => sortKey(a.message) - sortKey(b.message) || a.index - b.index)
    .map(({ message }) => message);
}
