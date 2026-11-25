/** Favorites are a set of huarique ids per user (US-11: a huarique can be saved only once). */

/** Adds an id keeping insertion order and never duplicating it. */
export function addUnique(ids, huariqueId) {
  return ids.includes(huariqueId) ? [...ids] : [...ids, huariqueId];
}

export function removeId(ids, huariqueId) {
  return ids.filter((id) => id !== huariqueId);
}

/**
 * Accepts what GET /community/favorites/me may return: ids, or objects with `huariqueId`
 * (and optionally `createdAt`). Duplicates are collapsed.
 */
export function normalizeFavorites(data) {
  const list = Array.isArray(data) ? data : (data?.favorites ?? []);
  const ids = list.map((entry) => (typeof entry === 'string' ? entry : entry?.huariqueId));
  return ids.filter(Boolean).reduce(addUnique, []);
}
