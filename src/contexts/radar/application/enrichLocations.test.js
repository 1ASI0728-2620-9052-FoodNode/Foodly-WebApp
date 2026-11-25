import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HttpError } from '../../../shared/http/HttpError.js';

vi.mock('../../business/infrastructure/BusinessService.js', () => ({
  businessService: { getHuarique: vi.fn(), getMenu: vi.fn() },
}));

import { businessService } from '../../business/infrastructure/BusinessService.js';
import { useHuariqueCatalogStore } from '../../business/application/useHuariqueCatalogStore.js';
import { enrichLocations } from './enrichLocations.js';

const location = (id, distanceMeters) => ({
  huariqueId: id,
  latitude: -12.12,
  longitude: -77.03,
  distanceMeters,
});
const huarique = (id) => ({ id, name: `Huarique ${id}`, tags: [] });
const notFound = () => new HttpError({ status: 404, message: 'No encontramos lo que buscas.' });
const serverError = () => new HttpError({ status: 500, message: 'Servicio caído' });

describe('enrichLocations (pure)', () => {
  it('completes each location with its huarique, keeping Radar order', async () => {
    const loadMany = vi.fn().mockResolvedValue({
      huariques: new Map([
        ['a', huarique('a')],
        ['b', huarique('b')],
      ]),
      missingIds: [],
      failedIds: [],
    });
    const { items } = await enrichLocations([location('a', 100), location('b', 250)], loadMany);

    expect(items.map((i) => [i.huariqueId, i.huarique.name, i.distanceMeters])).toEqual([
      ['a', 'Huarique a', 100],
      ['b', 'Huarique b', 250],
    ]);
  });

  it('drops locations that Business answered 404 for and counts them', async () => {
    const loadMany = vi.fn().mockResolvedValue({
      huariques: new Map([['a', huarique('a')]]),
      missingIds: ['gone'],
      failedIds: [],
    });
    const result = await enrichLocations([location('gone', 50), location('a', 80)], loadMany);

    expect(result.items.map((i) => i.huariqueId)).toEqual(['a']);
    expect(result).toMatchObject({ missingCount: 1, failedCount: 0 });
  });

  it('does not call Business when Radar returned nothing', async () => {
    const loadMany = vi.fn();
    expect(await enrichLocations([], loadMany)).toEqual({
      items: [],
      missingCount: 0,
      failedCount: 0,
    });
    expect(loadMany).not.toHaveBeenCalled();
  });
});

describe('enrichment through the catalog store (Radar + Business)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    businessService.getHuarique.mockReset();
  });

  it('tolerates a 404 among the results and still returns the rest', async () => {
    businessService.getHuarique.mockImplementation(async (id) => {
      if (id === 'gone') throw notFound();
      return huarique(id);
    });
    const catalog = useHuariqueCatalogStore();

    const result = await enrichLocations(
      [location('a', 10), location('gone', 20), location('b', 30)],
      catalog.loadMany,
    );

    expect(result.items.map((i) => i.huariqueId)).toEqual(['a', 'b']);
    expect(result.missingCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });

  it('tolerates non-404 failures per item and reports them', async () => {
    businessService.getHuarique.mockImplementation(async (id) => {
      if (id === 'bad') throw serverError();
      return huarique(id);
    });
    const catalog = useHuariqueCatalogStore();

    const result = await enrichLocations(
      [location('a', 10), location('bad', 20)],
      catalog.loadMany,
    );

    expect(result.items.map((i) => i.huariqueId)).toEqual(['a']);
    expect(result.failedCount).toBe(1);
  });

  it('requests all huariques in parallel, not one after another', async () => {
    const resolvers = [];
    businessService.getHuarique.mockImplementation(
      (id) => new Promise((resolve) => resolvers.push(() => resolve(huarique(id)))),
    );
    const catalog = useHuariqueCatalogStore();

    const pending = catalog.loadMany(['a', 'b', 'c']);
    await Promise.resolve();

    expect(businessService.getHuarique).toHaveBeenCalledTimes(3); // all started before any finished
    resolvers.forEach((resolve) => resolve());
    expect((await pending).huariques.size).toBe(3);
  });

  it('caches results: a second search does not hit Business again', async () => {
    businessService.getHuarique.mockImplementation(async (id) => huarique(id));
    const catalog = useHuariqueCatalogStore();

    await catalog.loadMany(['a', 'b']);
    await catalog.loadMany(['a', 'b']);

    expect(businessService.getHuarique).toHaveBeenCalledTimes(2);
  });

  it('caches a 404 too, and retries after a transient failure', async () => {
    const catalog = useHuariqueCatalogStore();

    businessService.getHuarique.mockRejectedValueOnce(notFound());
    expect(await catalog.get('gone')).toBeNull();
    expect(await catalog.get('gone')).toBeNull();
    expect(businessService.getHuarique).toHaveBeenCalledTimes(1);

    businessService.getHuarique.mockRejectedValueOnce(serverError());
    await expect(catalog.get('flaky')).rejects.toBeDefined();
    businessService.getHuarique.mockResolvedValueOnce(huarique('flaky'));
    expect((await catalog.get('flaky')).id).toBe('flaky');
  });

  it('shares a request that is already in flight for the same id', async () => {
    let resolve;
    businessService.getHuarique.mockImplementation(
      () => new Promise((r) => (resolve = () => r(huarique('a')))),
    );
    const catalog = useHuariqueCatalogStore();

    const first = catalog.get('a');
    const second = catalog.get('a');
    resolve();
    await Promise.all([first, second]);

    expect(businessService.getHuarique).toHaveBeenCalledTimes(1);
  });

  it('deduplicates repeated ids inside one loadMany', async () => {
    businessService.getHuarique.mockImplementation(async (id) => huarique(id));
    const catalog = useHuariqueCatalogStore();
    await catalog.loadMany(['a', 'a', 'a']);
    expect(businessService.getHuarique).toHaveBeenCalledTimes(1);
  });
});
