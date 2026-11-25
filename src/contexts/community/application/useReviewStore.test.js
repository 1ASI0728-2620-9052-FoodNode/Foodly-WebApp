import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { MockReviewService } from '../infrastructure/MockReviewService.js';
import { ReviewService } from '../infrastructure/ReviewService.js';

const { holder } = vi.hoisted(() => ({ holder: { service: null } }));
vi.mock('../infrastructure/reviewServiceFactory.js', () => ({
  createReviewService: () => ({
    list: (...a) => holder.service.list(...a),
    create: (...a) => holder.service.create(...a),
  }),
}));

import { useReviewStore } from './useReviewStore.js';

const reservation = (status, id = 'r1') => ({ id, huariqueId: 'h1', status });
const form = (patch = {}) => ({
  tasteRating: 5,
  serviceRating: 5,
  starDish: 'Ceviche',
  comment: 'Una experiencia buenísima, volveré pronto.',
  ...patch,
});

describe('useReviewStore (verified reviews)', () => {
  let store;

  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    holder.service = new MockReviewService();
    store = useReviewStore();
  });

  it('publishes a review for an APPROVED reservation and shows it as verified', async () => {
    await store.load('h1');
    const result = await store.submit({ reservation: reservation('APPROVED'), form: form() });

    expect(result.ok).toBe(true);
    expect(store.reviewsOf('h1')).toHaveLength(1);
    expect(store.reviewsOf('h1')[0]).toMatchObject({ reservationId: 'r1', verified: true });
    expect(store.summaryOf('h1')).toMatchObject({ count: 1, average: 5 });
  });

  it('accepts a COMPLETED reservation too', async () => {
    expect((await store.submit({ reservation: reservation('COMPLETED'), form: form() })).ok).toBe(
      true,
    );
  });

  it.each(['PENDING', 'REJECTED', 'EXPIRED'])(
    'refuses a %s reservation without calling the service',
    async (status) => {
      const spy = vi.spyOn(holder.service, 'create');
      const result = await store.submit({ reservation: reservation(status), form: form() });
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it('allows only one review per reservation', async () => {
    await store.load('h1');
    await store.submit({ reservation: reservation('APPROVED'), form: form() });
    const second = await store.submit({ reservation: reservation('APPROVED'), form: form() });

    expect(second.ok).toBe(false);
    expect(second.error).toMatch(/Ya reseñaste/);
    expect(store.reviewsOf('h1')).toHaveLength(1);
  });

  it('the service also rejects a duplicate (409) if the local list was stale', async () => {
    await holder.service.create('h1', { ...form(), reservationId: 'r1' });
    // The store never loaded the wall, so it does not know about that review.
    const result = await store.submit({ reservation: reservation('APPROVED'), form: form() });
    expect(result).toMatchObject({ ok: false, error: 'Ya reseñaste esta reserva.' });
  });

  it('rejects an invalid form with field errors and does not publish', async () => {
    const result = await store.submit({
      reservation: reservation('APPROVED'),
      form: form({ comment: 'corto', tasteRating: 0 }),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.comment).toBeTruthy();
    expect(result.errors.tasteRating).toBeTruthy();
    expect(store.reviewsOf('h1')).toEqual([]);
  });

  it('exposes eligibility for the form', async () => {
    await store.load('h1');
    expect(store.eligibility(reservation('PENDING')).allowed).toBe(false);
    expect(store.eligibility(reservation('APPROVED')).allowed).toBe(true);
    await store.submit({ reservation: reservation('APPROVED'), form: form() });
    expect(store.eligibility(reservation('APPROVED')).allowed).toBe(false);
  });

  it('keeps reviews of different huariques apart', async () => {
    await holder.service.create('h2', { ...form(), reservationId: 'r9' });
    await store.load('h1');
    await store.load('h2');
    expect(store.reviewsOf('h1')).toEqual([]);
    expect(store.reviewsOf('h2')).toHaveLength(1);
  });
});

describe('ReviewService (HTTP, informe 5.4.2)', () => {
  it('uses the community endpoints and the exact body', async () => {
    const client = {
      get: vi
        .fn()
        .mockResolvedValue([{ id: '1', reservationId: 'r1', tasteRating: 4, serviceRating: 5 }]),
      post: vi
        .fn()
        .mockResolvedValue({ id: '2', reservationId: 'r1', tasteRating: 4, serviceRating: 5 }),
    };
    const service = new ReviewService(client);

    expect((await service.list('h1'))[0].verified).toBe(true);
    expect(client.get).toHaveBeenCalledWith('/community/huariques/h1/reviews');

    const payload = {
      tasteRating: 4,
      serviceRating: 5,
      starDish: 'Ceviche',
      comment: 'x'.repeat(20),
      reservationId: 'r1',
    };
    await service.create('h1', payload);
    expect(client.post).toHaveBeenCalledWith('/community/huariques/h1/reviews', payload);
  });
});
