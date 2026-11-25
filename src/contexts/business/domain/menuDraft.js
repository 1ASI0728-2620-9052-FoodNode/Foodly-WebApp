import { LIMITS, parseMoney } from './huariqueForm.js';

/**
 * Editable copy of the menu. Items that already exist keep their `id` (Business uses it to keep
 * their photos); new ones have none and the server assigns it. `key` is only for Vue's v-for.
 */
let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

export const newDish = () => ({
  key: nextKey(),
  id: null,
  name: '',
  price: '',
  description: '',
  available: true,
});
export const newCategory = () => ({ key: nextKey(), id: null, name: '', dishes: [newDish()] });

export function menuToDraft(menu) {
  return menu.categories.map((category) => ({
    key: nextKey(),
    id: category.id,
    name: category.name,
    dishes: category.dishes.map((dish) => ({
      key: nextKey(),
      id: dish.id,
      name: dish.name,
      price: String(dish.price),
      description: dish.description,
      available: dish.available,
    })),
  }));
}

/** Requests.MenuBody.categories: ids only for existing items, so new ones get a fresh id. */
export function draftToCategories(draft) {
  return draft.map((category) => ({
    ...(category.id ? { id: category.id } : {}),
    name: category.name.trim(),
    dishes: category.dishes.map((dish) => ({
      ...(dish.id ? { id: dish.id } : {}),
      name: dish.name.trim(),
      description: dish.description.trim(),
      price: parseMoney(dish.price),
      available: dish.available,
    })),
  }));
}

export function validateMenuDraft(draft) {
  const errors = {};
  if (draft.length > 30) errors.menu = 'Máximo 30 categorías.';
  draft.forEach((category, ci) => {
    const name = category.name.trim();
    if (!name) errors[`category-${ci}`] = 'Ingresa el nombre de la categoría.';
    else if (name.length > LIMITS.CATEGORY_NAME)
      errors[`category-${ci}`] = `Máximo ${LIMITS.CATEGORY_NAME} caracteres.`;
    if (category.dishes.length > 100)
      errors[`category-${ci}`] = 'Máximo 100 platillos por categoría.';
    category.dishes.forEach((dish, di) => {
      const dishName = dish.name.trim();
      if (!dishName) errors[`dish-${ci}-${di}-name`] = 'Ingresa el nombre del platillo.';
      else if (dishName.length > LIMITS.DISH_NAME)
        errors[`dish-${ci}-${di}-name`] = `Máximo ${LIMITS.DISH_NAME} caracteres.`;
      if (Number.isNaN(parseMoney(dish.price)))
        errors[`dish-${ci}-${di}-price`] = 'Precio inválido (S/, hasta 2 decimales).';
      if (dish.description.length > LIMITS.DISH_DESCRIPTION)
        errors[`dish-${ci}-${di}-description`] = 'Descripción demasiado larga.';
    });
  });
  return { errors, valid: Object.keys(errors).length === 0 };
}
