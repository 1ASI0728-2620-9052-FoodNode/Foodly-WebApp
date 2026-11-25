import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, filterHuariques, hasActiveFilters } from './huariqueFilters.js';
import { priceLevelOf, toHuarique } from './huarique.js';

const make = (overrides) => ({
  huarique: {
    id: 'x',
    name: 'Huarique',
    address: 'Av. Larco 100, Miraflores',
    cuisineType: 'CRIOLLA',
    priceLevel: 1,
    isOpen: true,
    tags: [],
    location: { latitude: -12.12, longitude: -77.03 },
    ...overrides,
  },
});

const items = [
  make({
    id: '1',
    name: 'Cevichería Don Pepe',
    cuisineType: 'MARINA',
    priceLevel: 2,
    tags: ['Ceviche', 'Pescado'],
  }),
  make({
    id: '2',
    name: 'Chifa Wong',
    cuisineType: 'CHIFA',
    priceLevel: 1,
    isOpen: false,
    tags: ['lomo saltado'],
  }),
  make({
    id: '3',
    name: 'El Rincón Criollo',
    cuisineType: 'CRIOLLA',
    priceLevel: 3,
    address: 'Jr. Cusco 5, Cercado de Lima',
    location: { latitude: -12.046, longitude: -77.043 },
    tags: [],
  }),
];
const ids = (list) => list.map((i) => i.huarique.id);

describe('filterHuariques', () => {
  it('returns everything with empty filters', () => {
    expect(ids(filterHuariques(items, EMPTY_FILTERS))).toEqual(['1', '2', '3']);
  });

  it('matches text on the name, ignoring case and accents', () => {
    expect(ids(filterHuariques(items, { ...EMPTY_FILTERS, text: 'RINCON' }))).toEqual(['3']);
  });

  it('matches text on tags', () => {
    expect(ids(filterHuariques(items, { ...EMPTY_FILTERS, text: 'ceviche' }))).toEqual(['1']);
    expect(ids(filterHuariques(items, { ...EMPTY_FILTERS, text: 'lomo' }))).toEqual(['2']);
  });

  it('filters by the real CuisineType values', () => {
    expect(ids(filterHuariques(items, { ...EMPTY_FILTERS, cuisine: 'CHIFA' }))).toEqual(['2']);
  });

  it('filters by price level, accepting the select string value', () => {
    expect(ids(filterHuariques(items, { ...EMPTY_FILTERS, priceLevel: '3' }))).toEqual(['3']);
    expect(ids(filterHuariques(items, { ...EMPTY_FILTERS, priceLevel: 1 }))).toEqual(['2']);
  });

  it('filters "Abierto Ahora"', () => {
    expect(ids(filterHuariques(items, { ...EMPTY_FILTERS, openNow: true }))).toEqual(['1', '3']);
  });

  it('filters by district using the address first, then coordinates', () => {
    expect(ids(filterHuariques(items, { ...EMPTY_FILTERS, district: 'cercado' }))).toEqual(['3']);
    expect(ids(filterHuariques(items, { ...EMPTY_FILTERS, district: 'miraflores' }))).toEqual([
      '1',
      '2',
    ]);
  });

  it('combines every filter with AND', () => {
    const result = filterHuariques(items, {
      text: 'don',
      cuisine: 'MARINA',
      priceLevel: '2',
      openNow: true,
      district: 'miraflores',
    });
    expect(ids(result)).toEqual(['1']);
    expect(filterHuariques(items, { ...EMPTY_FILTERS, cuisine: 'CHIFA', openNow: true })).toEqual(
      [],
    );
  });

  it('does not mutate the input', () => {
    const copy = [...items];
    filterHuariques(items, { ...EMPTY_FILTERS, text: 'chifa' });
    expect(items).toEqual(copy);
  });
});

describe('hasActiveFilters', () => {
  it('detects any active filter', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, text: '  ' })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, openNow: true })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, priceLevel: '0' })).toBe(true);
  });
});

describe('huarique mapping', () => {
  it('derives the price level from the maximum price', () => {
    expect([
      priceLevelOf(10),
      priceLevelOf(25),
      priceLevelOf(25.5),
      priceLevelOf(50),
      priceLevelOf(80),
    ]).toEqual([1, 1, 2, 2, 3]);
  });

  it('normalizes a Business HuariqueView', () => {
    const huarique = toHuarique({
      id: 'h1',
      ownerId: 'o1',
      name: 'Don Pepe',
      address: 'Miraflores',
      cuisineType: 'MARINA',
      priceRange: { minimum: 20, maximum: 45.5 },
      location: { latitude: -12.12, longitude: -77.03 },
      openStatus: 'OPEN',
      tags: ['ceviche'],
      openingHours: [{ day: 'MONDAY', opensAt: '12:00:00', closesAt: '22:30:00' }],
      images: [{ id: 'i1', url: 'https://img/1.jpg' }],
      version: 3,
    });
    expect(huarique).toMatchObject({
      isOpen: true,
      priceMin: 20,
      priceMax: 45.5,
      priceLevel: 2,
      version: 3,
      openingHours: [{ day: 'MONDAY', opensAt: '12:00', closesAt: '22:30' }],
    });
  });
});
