import { CUISINE_TYPES, DAY_ORDER } from './huarique.js';

/**
 * Form model and validation for registering/editing a huarique. Mirrors Foodly-Business-Service
 * (Requests.Profile + domain rules): name ≤150, address ≤300, tags ≤20 unique ≤40 chars each,
 * prices ≥0 with ≤2 decimals and min ≤ max, coordinates in range, opening hours ≤28 with
 * opens < closes (same day) and no overlap within a day. Messages are in Spanish.
 */

export const LIMITS = Object.freeze({
  NAME: 150,
  ADDRESS: 300,
  TAGS: 20,
  TAG: 40,
  SLOTS: 28,
  DISH_NAME: 150,
  DISH_DESCRIPTION: 2000,
  CATEGORY_NAME: 100,
  MAX_PRICE: 99_999_999.99,
});

export const STAR_DISHES = 2;
const MONEY_PATTERN = /^\d{1,8}([.,]\d{1,2})?$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function emptyHuariqueForm() {
  return {
    name: '',
    cuisineType: '',
    tags: [],
    address: '',
    priceMin: '',
    priceMax: '',
    latitude: null,
    longitude: null,
    openingHours: [],
    dishes: Array.from({ length: STAR_DISHES }, () => ({ name: '', price: '' })),
  };
}

export function formFromHuarique(huarique) {
  return {
    ...emptyHuariqueForm(),
    name: huarique.name,
    cuisineType: huarique.cuisineType,
    tags: [...huarique.tags],
    address: huarique.address,
    priceMin: String(huarique.priceMin),
    priceMax: String(huarique.priceMax),
    latitude: huarique.location.latitude,
    longitude: huarique.location.longitude,
    openingHours: huarique.openingHours.map((slot) => ({ ...slot })),
  };
}

/** "25", "25.5" or "25,50" -> number; NaN when it is not a valid amount with up to 2 decimals. */
export function parseMoney(value) {
  const text = String(value ?? '').trim();
  if (!MONEY_PATTERN.test(text)) return NaN;
  return Number(text.replace(',', '.'));
}

const hasErrors = (errors) => Object.values(errors).some(Boolean);
const result = (errors) => ({ errors, valid: !hasErrors(errors) });

// --- step 1: identity ----------------------------------------------------------------------

export function validateTags(tags) {
  if (tags.length > LIMITS.TAGS) return `Máximo ${LIMITS.TAGS} etiquetas.`;
  if (tags.some((tag) => !tag.trim())) return 'Las etiquetas no pueden estar vacías.';
  if (tags.some((tag) => tag.trim().length > LIMITS.TAG)) {
    return `Cada etiqueta admite hasta ${LIMITS.TAG} caracteres.`;
  }
  const lower = tags.map((tag) => tag.trim().toLowerCase());
  if (new Set(lower).size !== lower.length) return 'Hay etiquetas repetidas.';
  return '';
}

export function validateIdentity(form) {
  const name = form.name.trim();
  return result({
    name: !name
      ? 'Ingresa el nombre oficial del huarique.'
      : name.length > LIMITS.NAME
        ? `El nombre admite hasta ${LIMITS.NAME} caracteres.`
        : '',
    cuisineType: form.cuisineType in CUISINE_TYPES ? '' : 'Elige una especialidad.',
    tags: validateTags(form.tags),
  });
}

// --- step 2: prices and location -----------------------------------------------------------

export function validatePricingAndLocation(form) {
  const min = parseMoney(form.priceMin);
  const max = parseMoney(form.priceMax);
  const address = form.address.trim();
  const hasPin = Number.isFinite(form.latitude) && Number.isFinite(form.longitude);

  return result({
    priceMin: Number.isNaN(min) ? 'Ingresa un monto válido en S/ (hasta 2 decimales).' : '',
    priceMax: Number.isNaN(max)
      ? 'Ingresa un monto válido en S/ (hasta 2 decimales).'
      : !Number.isNaN(min) && min > max
        ? 'El precio máximo no puede ser menor que el mínimo.'
        : '',
    address: !address
      ? 'Ingresa la dirección.'
      : address.length > LIMITS.ADDRESS
        ? `La dirección admite hasta ${LIMITS.ADDRESS} caracteres.`
        : '',
    location: !hasPin
      ? 'Marca la ubicación en el mapa o usa tu ubicación actual.'
      : Math.abs(form.latitude) > 90 || Math.abs(form.longitude) > 180
        ? 'La ubicación está fuera de rango.'
        : '',
  });
}

// --- step 3: hours and star dishes ---------------------------------------------------------

const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export function validateOpeningHours(slots) {
  if (slots.length === 0) return 'Agrega al menos un horario de atención.';
  if (slots.length > LIMITS.SLOTS) return `Máximo ${LIMITS.SLOTS} horarios.`;
  for (const slot of slots) {
    if (
      !DAY_ORDER.includes(slot.day) ||
      !TIME_PATTERN.test(slot.opensAt) ||
      !TIME_PATTERN.test(slot.closesAt)
    ) {
      return 'Completa la hora de apertura y de cierre de cada horario.';
    }
    if (toMinutes(slot.opensAt) >= toMinutes(slot.closesAt)) {
      return 'La hora de cierre debe ser posterior a la de apertura, el mismo día.';
    }
  }
  for (const day of DAY_ORDER) {
    const ranges = slots
      .filter((slot) => slot.day === day)
      .map((slot) => [toMinutes(slot.opensAt), toMinutes(slot.closesAt)])
      .sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ranges.length; i += 1) {
      if (ranges[i][0] < ranges[i - 1][1]) return 'Hay horarios que se cruzan en el mismo día.';
    }
  }
  return '';
}

/** @returns {{ name: string, price: string }[]} one entry of errors per dish */
export function validateStarDishes(dishes) {
  return dishes.map((dish) => {
    const name = dish.name.trim();
    return {
      name: !name
        ? 'Ingresa el nombre del platillo.'
        : name.length > LIMITS.DISH_NAME
          ? `Máximo ${LIMITS.DISH_NAME} caracteres.`
          : '',
      price: Number.isNaN(parseMoney(dish.price)) ? 'Ingresa un precio válido en S/.' : '',
    };
  });
}

export function validateScheduleAndDishes(form) {
  const dishErrors = validateStarDishes(form.dishes);
  const countError =
    form.dishes.length === STAR_DISHES
      ? ''
      : `Registra exactamente ${STAR_DISHES} platillos estrella.`;
  const errors = {
    openingHours: validateOpeningHours(form.openingHours),
    dishes: countError,
  };
  const valid = !hasErrors(errors) && dishErrors.every((e) => !e.name && !e.price);
  return { errors: { ...errors, dishList: dishErrors }, valid };
}

export const ONBOARDING_STEPS = Object.freeze([
  { id: 1, title: 'Identidad', validate: validateIdentity },
  { id: 2, title: 'Precios y ubicación', validate: validatePricingAndLocation },
  { id: 3, title: 'Horarios y platillos', validate: validateScheduleAndDishes },
]);

/** Profile section of the edit screen (identity + prices + location + hours, no dishes). */
export function validateProfile(form) {
  const parts = [validateIdentity(form), validatePricingAndLocation(form)];
  const hours = validateOpeningHours(form.openingHours);
  return {
    errors: { ...parts[0].errors, ...parts[1].errors, openingHours: hours },
    valid: parts.every((p) => p.valid) && !hours,
  };
}

// --- payloads -------------------------------------------------------------------------------

/** Requests.Profile (without `version`, which the service adds on updates). */
export function toProfilePayload(form) {
  return {
    name: form.name.trim(),
    address: form.address.trim(),
    cuisineType: form.cuisineType,
    priceRange: { minimum: parseMoney(form.priceMin), maximum: parseMoney(form.priceMax) },
    location: { latitude: form.latitude, longitude: form.longitude },
    tags: form.tags.map((tag) => tag.trim()),
    openingHours: form.openingHours.map(({ day, opensAt, closesAt }) => ({
      day,
      opensAt,
      closesAt,
    })),
  };
}

/** Requests.MenuBody categories for the onboarding menu: one category with the star dishes. */
export function toStarMenuCategories(dishes) {
  return [
    {
      name: 'Platillos estrella',
      dishes: dishes.map((dish) => ({
        name: dish.name.trim(),
        description: '',
        price: parseMoney(dish.price),
        available: true,
      })),
    },
  ];
}
