import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../infrastructure/RadarService.js', () => ({ radarService: { search: vi.fn() } }));
vi.mock('../../business/infrastructure/BusinessService.js', () => ({
  businessService: { getHuarique: vi.fn(), getMenu: vi.fn() },
}));
vi.mock('../../../shared/geo/geolocation.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getCurrentLocation: vi.fn(),
}));

import { radarService } from '../infrastructure/RadarService.js';
import { businessService } from '../../business/infrastructure/BusinessService.js';
import { GEO_ERRORS, getCurrentLocation } from '../../../shared/geo/geolocation.js';
import { K_RING_DEFAULT, RADAR_STATUS, useRadarStore } from './useRadarStore.js';

const found = (id, distanceMeters) => ({
  huariqueId: id,
  latitude: -12.12,
  longitude: -77.03,
  distanceMeters,
});
const huarique = (id, extra = {}) => ({
  id,
  name: `H ${id}`,
  tags: [],
  isOpen: true,
  cuisineType: 'CRIOLLA',
  priceLevel: 1,
  address: 'Miraflores',
  location: { latitude: -12.12, longitude: -77.03 },
  ...extra,
});

describe('useRadarStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    radarService.search.mockReset();
    businessService.getHuarique.mockReset();
    getCurrentLocation.mockReset();
    businessService.getHuarique.mockImplementation(async (id) => huarique(id));
  });

  it('searches with k-ring 2 by default and the chosen district coordinates', async () => {
    radarService.search.mockResolvedValue([found('a', 120)]);
    const radar = useRadarStore();

    await radar.chooseDistrict('miraflores');

    expect(K_RING_DEFAULT).toBe(2);
    expect(radarService.search).toHaveBeenCalledWith({
      latitude: -12.1219,
      longitude: -77.0297,
      kRing: 2,
    });
    expect(radar.status).toBe(RADAR_STATUS.SUCCESS);
    expect(radar.items[0]).toMatchObject({ huariqueId: 'a', distanceMeters: 120 });
    expect(radar.items[0].huarique.name).toBe('H a');
    expect(radar.searchMs).toBeGreaterThanOrEqual(0);
  });

  it('clamps k-ring to 1..5 and searches again', async () => {
    radarService.search.mockResolvedValue([]);
    const radar = useRadarStore();
    await radar.chooseDistrict('barranco');

    await radar.setKRing(9);
    expect(radar.kRing).toBe(5);
    await radar.setKRing(0);
    expect(radar.kRing).toBe(1);
    expect(radarService.search).toHaveBeenLastCalledWith(expect.objectContaining({ kRing: 1 }));
  });

  it('computes the H3 coverage: 3k(k+1)+1 cells around the user', async () => {
    radarService.search.mockResolvedValue([]);
    const radar = useRadarStore();
    await radar.chooseDistrict('miraflores');

    expect(radar.coverage.cells).toHaveLength(19); // k = 2
    expect(radar.coverage.polygons.filter((p) => p.isOrigin)).toHaveLength(1);
    await radar.setKRing(3);
    expect(radar.coverage.cells).toHaveLength(37);
  });

  it('shows the empty state when the zone has no huariques', async () => {
    radarService.search.mockResolvedValue([]);
    const radar = useRadarStore();
    await radar.chooseDistrict('lince');

    expect(radar.status).toBe(RADAR_STATUS.SUCCESS);
    expect(radar.isEmpty).toBe(true);
    expect(businessService.getHuarique).not.toHaveBeenCalled();
  });

  it('drops a result Business no longer has (404) without failing the search', async () => {
    radarService.search.mockResolvedValue([found('a', 10), found('gone', 20)]);
    businessService.getHuarique.mockImplementation(async (id) => {
      if (id === 'gone') throw { status: 404 };
      return huarique(id);
    });
    const radar = useRadarStore();
    await radar.chooseDistrict('miraflores');

    expect(radar.status).toBe(RADAR_STATUS.SUCCESS);
    expect(radar.items.map((i) => i.huariqueId)).toEqual(['a']);
  });

  it('goes to the error state when Radar fails, and can retry', async () => {
    radarService.search.mockRejectedValueOnce({ status: 500, message: 'Servicio caído' });
    const radar = useRadarStore();
    await radar.chooseDistrict('miraflores');

    expect(radar.status).toBe(RADAR_STATUS.ERROR);
    expect(radar.error).toBe('Servicio caído');

    radarService.search.mockResolvedValue([found('a', 1)]);
    await radar.search();
    expect(radar.status).toBe(RADAR_STATUS.SUCCESS);
    expect(radar.error).toBe('');
  });

  it('goes to the error state when every Business lookup fails', async () => {
    radarService.search.mockResolvedValue([found('a', 1), found('b', 2)]);
    businessService.getHuarique.mockRejectedValue({ status: 500 });
    const radar = useRadarStore();
    await radar.chooseDistrict('miraflores');
    expect(radar.status).toBe(RADAR_STATUS.ERROR);
  });

  it('keeps the partial list and flags it when some lookups fail', async () => {
    radarService.search.mockResolvedValue([found('a', 1), found('b', 2)]);
    businessService.getHuarique.mockImplementation(async (id) => {
      if (id === 'b') throw { status: 500 };
      return huarique(id);
    });
    const radar = useRadarStore();
    await radar.chooseDistrict('miraflores');
    expect(radar.items).toHaveLength(1);
    expect(radar.incompleteCount).toBe(1);
  });

  it('stores GPS coordinates when the user shares the location', async () => {
    getCurrentLocation.mockResolvedValue({ latitude: -12.1, longitude: -77.04 });
    radarService.search.mockResolvedValue([]);
    const radar = useRadarStore();

    expect(await radar.shareLocation()).toBe(true);
    expect(radar.location).toMatchObject({ latitude: -12.1, longitude: -77.04, source: 'gps' });
  });

  it('keeps the denial reason and does not search when permission is denied', async () => {
    getCurrentLocation.mockRejectedValue({ code: GEO_ERRORS.DENIED });
    const radar = useRadarStore();

    expect(await radar.shareLocation()).toBe(false);
    expect(radar.permissionDenied).toBe(true);
    expect(radar.location).toBeNull();
    expect(radarService.search).not.toHaveBeenCalled();
    expect(radar.status).toBe(RADAR_STATUS.IDLE);
  });

  it('searches again from the dragged marker position', async () => {
    getCurrentLocation.mockRejectedValue({ code: GEO_ERRORS.DENIED });
    radarService.search.mockResolvedValue([]);
    const radar = useRadarStore();
    await radar.shareLocation();

    await radar.setManualLocation({ latitude: -12.15, longitude: -77.02 });

    expect(radar.location.source).toBe('manual');
    expect(radarService.search).toHaveBeenCalledWith({
      latitude: -12.15,
      longitude: -77.02,
      kRing: 2,
    });
    expect(radar.permissionDenied).toBe(true); // the explanation stays visible
  });

  it('only applies the latest of two overlapping searches', async () => {
    let releaseFirst;
    radarService.search
      .mockImplementationOnce(
        () => new Promise((resolve) => (releaseFirst = () => resolve([found('old', 1)]))),
      )
      .mockResolvedValueOnce([found('new', 1)]);
    const radar = useRadarStore();

    const first = radar.chooseDistrict('miraflores');
    await radar.chooseDistrict('barranco');
    releaseFirst();
    await first;

    expect(radar.items.map((i) => i.huariqueId)).toEqual(['new']);
  });

  it('filters the loaded results on the client', async () => {
    radarService.search.mockResolvedValue([found('a', 1), found('b', 2)]);
    businessService.getHuarique.mockImplementation(async (id) =>
      huarique(id, { isOpen: id === 'a' }),
    );
    const radar = useRadarStore();
    await radar.chooseDistrict('miraflores');

    radar.setFilters({ openNow: true });
    expect(radar.filteredItems.map((i) => i.huariqueId)).toEqual(['a']);
    radar.resetFilters();
    expect(radar.filteredItems).toHaveLength(2);
  });

  it('reset leaves nothing of the previous user', async () => {
    radarService.search.mockResolvedValue([found('a', 1)]);
    const radar = useRadarStore();
    await radar.chooseDistrict('miraflores');
    radar.reset();
    expect(radar.location).toBeNull();
    expect(radar.items).toEqual([]);
    expect(radar.status).toBe(RADAR_STATUS.IDLE);
  });
});
