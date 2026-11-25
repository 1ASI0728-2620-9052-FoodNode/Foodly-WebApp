/** Mapping and rules for Business-Service huariques. Wire format: Responses.HuariqueView / MenuView. */

/** Real CuisineType enum of Foodly-Business-Service. */
export const CUISINE_TYPES = Object.freeze({
  CRIOLLA: 'Criolla',
  MARINA: 'Marina',
  CHIFA: 'Chifa',
  OTHER: 'Otros',
});

export const OPEN_STATUS = Object.freeze({ OPEN: 'OPEN', CLOSED: 'CLOSED' });

export const DAY_ORDER = Object.freeze([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);

export const DAY_LABELS = Object.freeze({
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
});

/**
 * Client-side price level (Business has no such field), from the maximum price in soles:
 * 1 economic (up to S/ 25), 2 medium (up to S/ 50), 3 high.
 */
export const PRICE_LEVELS = Object.freeze([
  { value: 1, label: 'Económico (hasta S/ 25)', symbol: 'S/' },
  { value: 2, label: 'Medio (S/ 25 – 50)', symbol: 'S/ S/' },
  { value: 3, label: 'Alto (más de S/ 50)', symbol: 'S/ S/ S/' },
]);

export function priceLevelOf(maximum) {
  if (maximum <= 25) return 1;
  if (maximum <= 50) return 2;
  return 3;
}

const toHourMinute = (time) => String(time ?? '').slice(0, 5);

export function toImages(images) {
  return (images ?? []).map((image) => ({ id: image.id, url: image.url }));
}

/** @param {object} view HuariqueView as returned by Business */
export function toHuarique(view) {
  const min = Number(view.priceRange?.minimum ?? 0);
  const max = Number(view.priceRange?.maximum ?? 0);
  return {
    id: view.id,
    ownerId: view.ownerId,
    name: view.name,
    address: view.address,
    cuisineType: view.cuisineType,
    priceMin: min,
    priceMax: max,
    priceLevel: priceLevelOf(max),
    location: { latitude: view.location?.latitude, longitude: view.location?.longitude },
    isOpen: view.openStatus === OPEN_STATUS.OPEN,
    openStatus: view.openStatus,
    tags: view.tags ?? [],
    openingHours: (view.openingHours ?? []).map((h) => ({
      day: h.day,
      opensAt: toHourMinute(h.opensAt),
      closesAt: toHourMinute(h.closesAt),
    })),
    images: toImages(view.images),
    version: view.version ?? null,
  };
}

/** @param {object} view MenuView as returned by Business */
export function toMenu(view) {
  return {
    id: view?.id ?? null,
    version: view?.version ?? null,
    categories: (view?.categories ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      dishes: (category.dishes ?? []).map((dish) => ({
        id: dish.id,
        name: dish.name,
        description: dish.description ?? '',
        price: Number(dish.price),
        available: Boolean(dish.available),
        images: toImages(dish.images),
      })),
    })),
  };
}

export const EMPTY_MENU = Object.freeze({ id: null, version: null, categories: [] });

/** Opening hours ordered Monday to Sunday, then by opening time. */
export function sortedOpeningHours(openingHours) {
  return [...openingHours].sort(
    (a, b) =>
      DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.opensAt.localeCompare(b.opensAt),
  );
}
