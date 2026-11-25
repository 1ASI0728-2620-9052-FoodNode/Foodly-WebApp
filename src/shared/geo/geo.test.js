import { describe, expect, it, vi } from 'vitest';
import { distanceMeters } from './distance.js';
import { DISTRICTS, districtOf, findDistrict } from './districts.js';
import { buildCoverage, H3_RESOLUTION } from './h3Zone.js';
import { GEO_ERRORS, getCurrentLocation } from './geolocation.js';
import { formatDistance, formatPriceRange, formatSoles } from '../utils/format.js';

describe('geo', () => {
  it('lists the five requested districts with fixed coordinates', () => {
    expect(DISTRICTS.map((d) => d.name)).toEqual([
      'Miraflores',
      'Barranco',
      'Surquillo',
      'Lince',
      'Cercado de Lima',
    ]);
    expect(findDistrict('barranco')).toMatchObject({ latitude: -12.1497 });
    expect(findDistrict('nope')).toBeNull();
  });

  it('computes straight-line distance in meters', () => {
    const a = { latitude: -12.1219, longitude: -77.0297 };
    expect(distanceMeters(a, a)).toBe(0);
    const miraflores = DISTRICTS[0];
    const barranco = DISTRICTS[1];
    expect(distanceMeters(miraflores, barranco)).toBeGreaterThan(3000);
    expect(distanceMeters(miraflores, barranco)).toBeLessThan(4000);
  });

  it('assigns a district from the address, else from the nearest centroid', () => {
    expect(districtOf({ address: 'Av. X 1, Barranco', location: DISTRICTS[0] })).toBe('barranco');
    expect(
      districtOf({ address: 'Sin distrito', location: { latitude: -12.1495, longitude: -77.022 } }),
    ).toBe('barranco');
    expect(districtOf({ address: '?', location: { latitude: -11, longitude: -76 } })).toBeNull();
  });

  it('builds the H3 coverage at resolution 9 with 3k(k+1)+1 cells', () => {
    expect(H3_RESOLUTION).toBe(9);
    for (const k of [1, 2, 5]) {
      const { cells, origin, polygons } = buildCoverage(DISTRICTS[0], k);
      expect(cells).toHaveLength(3 * k * (k + 1) + 1);
      expect(cells).toContain(origin);
      expect(polygons[0].latLngs.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('maps geolocation failures to typed codes', async () => {
    const fake = (code) => ({ getCurrentPosition: (_ok, fail) => fail({ code }) });
    await expect(getCurrentLocation({ geolocation: fake(1) })).rejects.toEqual({
      code: GEO_ERRORS.DENIED,
    });
    await expect(getCurrentLocation({ geolocation: fake(2) })).rejects.toEqual({
      code: GEO_ERRORS.UNAVAILABLE,
    });
    await expect(getCurrentLocation({ geolocation: fake(3) })).rejects.toEqual({
      code: GEO_ERRORS.TIMEOUT,
    });
    await expect(getCurrentLocation({ geolocation: null })).rejects.toEqual({
      code: GEO_ERRORS.UNSUPPORTED,
    });
  });

  it('resolves coordinates on success', async () => {
    const geolocation = {
      getCurrentPosition: vi.fn((ok) => ok({ coords: { latitude: -12.1, longitude: -77.1 } })),
    };
    expect(await getCurrentLocation({ geolocation })).toEqual({
      latitude: -12.1,
      longitude: -77.1,
    });
  });
});

describe('format', () => {
  it('formats distances in m or km', () => {
    expect(formatDistance(111.2)).toBe('111 m');
    expect(formatDistance(999.4)).toBe('999 m');
    expect(formatDistance(1500)).toBe('1.5 km');
  });

  it('formats soles and ranges', () => {
    expect(formatSoles(25)).toBe('S/ 25');
    expect(formatSoles(25.5)).toBe('S/ 25.50');
    expect(formatPriceRange(20, 45)).toBe('S/ 20 – S/ 45');
    expect(formatPriceRange(30, 30)).toBe('S/ 30');
  });
});
