import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { addUnique, normalizeFavorites } from '../domain/favorites.js';
import { MockFavoriteService } from '../infrastructure/MockFavoriteService.js';
import { FavoriteService } from '../infrastructure/FavoriteService.js';

// The store uses whichever adapter the factory returns; tests give it the real localStorage mock.
const { holder } = vi.hoisted(() => ({ holder: { service: null } }));
vi.mock('../infrastructure/favoriteServiceFactory.js', () => ({
  createFavoriteService: () => ({
    list: (...a) => holder.service.list(...a),
    add: (...a) => holder.service.add(...a),
    remove: (...a) => holder.service.remove(...a),
  }),
}));

import { useFavoritesStore } from './useFavoritesStore.js';

describe('favorites domain', () => {
  it('never duplicates an id', () => {
    expect(addUnique(['a'], 'a')).toEqual(['a']);
    expect(addUnique(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('normalizes ids or objects and collapses duplicates', () => {
    expect(normalizeFavorites(['a', { huariqueId: 'b' }, 'a', null, {}])).toEqual(['a', 'b']);
    expect(normalizeFavorites({ favorites: [{ huariqueId: 'x' }] })).toEqual(['x']);
    expect(normalizeFavorites(undefined)).toEqual([]);
  });
});

describe('MockFavoriteService (localStorage per user)', () => {
  let userId;
  const service = () => new MockFavoriteService({ getUserId: () => userId });

  beforeEach(() => {
    localStorage.clear();
    userId = 'user-1';
  });

  it('adds without duplicates (US-11)', async () => {
    const mock = service();
    await mock.add('h1');
    await mock.add('h1');
    await mock.add('h2');
    expect(await mock.list()).toEqual(['h1', 'h2']);
  });

  it('removes and tolerates removing something that is not there', async () => {
    const mock = service();
    await mock.add('h1');
    await mock.remove('h1');
    await mock.remove('h1');
    expect(await mock.list()).toEqual([]);
  });

  it('keeps one list per user', async () => {
    await service().add('h1');
    userId = 'user-2';
    expect(await service().list()).toEqual([]);
    userId = 'user-1';
    expect(await service().list()).toEqual(['h1']);
  });

  it('survives corrupted storage', async () => {
    localStorage.setItem('foodly.community.favorites.user-1', '{not json');
    expect(await service().list()).toEqual([]);
  });
});

describe('FavoriteService (HTTP, informe 5.4.2)', () => {
  it('uses the community endpoints', async () => {
    const client = {
      get: vi.fn().mockResolvedValue([{ huariqueId: 'h1' }, { huariqueId: 'h1' }]),
      post: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(null),
    };
    const http = new FavoriteService(client);

    expect(await http.list()).toEqual(['h1']);
    expect(client.get).toHaveBeenCalledWith('/community/favorites/me');
    await http.add('h2');
    expect(client.post).toHaveBeenCalledWith('/community/favorites/h2');
    await http.remove('h2');
    expect(client.delete).toHaveBeenCalledWith('/community/favorites/h2');
  });

  it('treats 409 on add and 404 on remove as success', async () => {
    const client = {
      post: vi.fn().mockRejectedValue({ status: 409 }),
      delete: vi.fn().mockRejectedValue({ status: 404 }),
    };
    const http = new FavoriteService(client);
    await expect(http.add('h')).resolves.toBeUndefined();
    await expect(http.remove('h')).resolves.toBeUndefined();
  });

  it('propagates other errors', async () => {
    const http = new FavoriteService({ post: vi.fn().mockRejectedValue({ status: 500 }) });
    await expect(http.add('h')).rejects.toMatchObject({ status: 500 });
  });
});

describe('useFavoritesStore', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    holder.service = new MockFavoriteService({ getUserId: () => 'user-1' });
  });

  it('toggles a favorite on and off', async () => {
    const favorites = useFavoritesStore();
    await favorites.load();

    await favorites.toggle('h1');
    expect(favorites.isFavorite('h1')).toBe(true);
    await favorites.toggle('h1');
    expect(favorites.isFavorite('h1')).toBe(false);
  });

  it('keeps no duplicates even when the service already has the id', async () => {
    await holder.service.add('h1');
    const favorites = useFavoritesStore();
    await favorites.load();
    expect(favorites.ids).toEqual(['h1']);
    expect(favorites.count).toBe(1);
  });

  it('updates optimistically and reverts when the service fails', async () => {
    const favorites = useFavoritesStore();
    await favorites.load();
    holder.service = { ...holder.service, add: () => Promise.reject({ message: 'caído' }) };

    const result = favorites.toggle('h9');
    expect(favorites.isFavorite('h9')).toBe(true); // optimistic
    expect(await result).toBe(false);
    expect(favorites.isFavorite('h9')).toBe(false); // reverted
    expect(favorites.error).toBe('caído');
  });

  it('reset clears the list for the next session', async () => {
    const favorites = useFavoritesStore();
    await favorites.toggle('h1');
    favorites.reset();
    expect(favorites.ids).toEqual([]);
    expect(favorites.loaded).toBe(false);
  });
});
