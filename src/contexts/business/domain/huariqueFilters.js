import { districtOf, normalizeText } from '../../../shared/geo/districts.js';

export const EMPTY_FILTERS = Object.freeze({
  text: '',
  cuisine: '',
  priceLevel: '',
  openNow: false,
  district: '',
});

/**
 * Client-side filtering for lists of `{ huarique, ... }` items (Radar results, favorites).
 * - text: name or any tag, accent and case insensitive.
 * - cuisine: exact CuisineType. priceLevel: 1|2|3 (see PRICE_LEVELS). openNow: isOpen.
 * - district: id from shared/geo/districts.
 */
export function filterHuariques(items, filters = EMPTY_FILTERS) {
  const query = normalizeText(filters.text);
  const priceLevel = filters.priceLevel === '' ? null : Number(filters.priceLevel);

  return items.filter(({ huarique }) => {
    if (query) {
      const haystack = [huarique.name, ...huarique.tags].map(normalizeText);
      if (!haystack.some((value) => value.includes(query))) return false;
    }
    if (filters.cuisine && huarique.cuisineType !== filters.cuisine) return false;
    if (priceLevel !== null && huarique.priceLevel !== priceLevel) return false;
    if (filters.openNow && !huarique.isOpen) return false;
    if (filters.district && districtOf(huarique) !== filters.district) return false;
    return true;
  });
}

export function hasActiveFilters(filters) {
  return Boolean(
    filters.text.trim() ||
    filters.cuisine ||
    filters.priceLevel !== '' ||
    filters.openNow ||
    filters.district,
  );
}
