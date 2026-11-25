import { describe, expect, it } from 'vitest';
import {
  MAX_MESSAGE_LENGTH,
  matchByName,
  maxUserTextLength,
  mergeMessages,
  offersManualReservation,
  parseContext,
  parseRecommendationLines,
  toMessage,
  validateOutgoing,
  withHuariqueContext,
} from './chat.js';

const ID = '65f1c2a9-e4b0-4a1d-8c3f-4a5b6c7d8e9f';

describe('huarique context prefix', () => {
  it('round-trips and strips the prefix for display', () => {
    const sent = withHuariqueContext('¿Abren hoy?', ID);
    expect(sent).toBe(`[huarique:${ID}] ¿Abren hoy?`);
    expect(parseContext(sent)).toEqual({ huariqueId: ID, text: '¿Abren hoy?' });
  });

  it('leaves text without a prefix untouched', () => {
    expect(withHuariqueContext('Hola', null)).toBe('Hola');
    expect(parseContext('Hola [huarique:x]')).toEqual({
      huariqueId: null,
      text: 'Hola [huarique:x]',
    });
  });

  it('toMessage reads the id from the prefix when the API did not set one', () => {
    const message = toMessage({
      id: 'm1',
      sender: 'EXPLORER',
      content: `[huarique:${ID}] Hola`,
      sentAt: '2026-11-24T15:00:00',
    });
    expect(message).toMatchObject({ content: 'Hola', huariqueId: ID, pending: false });
  });
});

describe('validateOutgoing', () => {
  it('limits messages to 1000 characters', () => {
    expect(MAX_MESSAGE_LENGTH).toBe(1000);
    expect(validateOutgoing('a'.repeat(1000))).toBe('');
    expect(validateOutgoing('a'.repeat(1001))).not.toBe('');
  });

  it('reserves room for the huarique prefix', () => {
    expect(maxUserTextLength(ID)).toBe(1000 - `[huarique:${ID}] `.length);
    expect(validateOutgoing('a'.repeat(maxUserTextLength(ID)), ID)).toBe('');
    expect(validateOutgoing('a'.repeat(maxUserTextLength(ID) + 1), ID)).not.toBe('');
  });

  it('rejects empty and blank text', () => {
    expect(validateOutgoing('')).not.toBe('');
    expect(validateOutgoing('  \n ')).not.toBe('');
    expect(validateOutgoing(undefined)).not.toBe('');
  });
});

describe('mergeMessages', () => {
  const m = (id, sentAt, extra = {}) => ({ id, sentAt, ...extra });

  it('dedupes by id, preferring the incoming copy', () => {
    const merged = mergeMessages(
      [m('a', null, { pending: true })],
      [m('a', '2026-11-24T10:00:00', { pending: false })],
    );
    expect(merged).toEqual([m('a', '2026-11-24T10:00:00', { pending: false })]);
  });

  it('orders by sentAt and keeps unsent messages last, in arrival order', () => {
    const merged = mergeMessages(
      [m('local-1', null), m('b', '2026-11-24T10:00:02')],
      [m('a', '2026-11-24T10:00:01'), m('local-2', null)],
    );
    expect(merged.map((x) => x.id)).toEqual(['a', 'b', 'local-1', 'local-2']);
  });
});

describe('manual reservation (RF-15)', () => {
  const lia = (content) => ({ sender: 'LIA', content });

  it('detects the timeout notice and the failure messages that offer it', () => {
    expect(
      offersManualReservation(
        lia(
          'Lo siento, Lía está tardando más de lo esperado en responderte. Si lo prefieres, puedes hacer tu reserva de forma manual desde la ficha del huarique.',
        ),
      ),
    ).toBe(true);
  });

  it('ignores ordinary replies and the explorer’s own text', () => {
    expect(offersManualReservation(lia('Esto es lo que encontré cerca de ti'))).toBe(false);
    expect(
      offersManualReservation({
        sender: 'EXPLORER',
        content: 'quiero una reserva de forma manual',
      }),
    ).toBe(false);
  });
});

describe('recommendation parsing', () => {
  const content =
    'Esto es lo que encontré cerca de ti:\n1. Cevichería Don Pepe (a 320 m)\n2. Chifa  Wong (a 1.4 km)\nGracias';

  it('reads "N. Name (a distance)" lines', () => {
    expect(parseRecommendationLines(content)).toEqual([
      { name: 'Cevichería Don Pepe', distanceText: '320 m' },
      { name: 'Chifa  Wong', distanceText: '1.4 km' },
    ]);
  });

  it('ignores text without recommendation lines', () => {
    expect(parseRecommendationLines('Hola, ¿qué se te antoja?')).toEqual([]);
    expect(parseRecommendationLines(undefined)).toEqual([]);
  });

  it('matches names ignoring case and accents, without duplicates', () => {
    const candidates = [
      { huarique: { name: 'CEVICHERIA don pepe' }, id: 1 },
      { huarique: { name: 'Otro' }, id: 2 },
    ];
    const parsed = [
      { name: 'Cevichería Don Pepe' },
      { name: 'cevicheria don pepe' },
      { name: 'No existe' },
    ];
    expect(matchByName(parsed, candidates).map((c) => c.id)).toEqual([1]);
  });
});
