import { ref } from 'vue';
import { defineStore } from 'pinia';
import { businessService } from '../infrastructure/BusinessService.js';

/** Business answers can change (open/closed), so cached entries expire quickly. */
export const CATALOG_TTL_MS = 60_000;

/**
 * In-memory cache of huariques read from Business, shared by Radar, Favorites, Detail and chat.
 * - Requests for the same id that are already in flight are shared, never duplicated.
 * - A 404 is a valid answer ("that huarique no longer exists") and is cached as `null`.
 * - Other errors are never cached, so the next call retries.
 */
export const useHuariqueCatalogStore = defineStore('huarique-catalog', () => {
  const entries = new Map(); // id -> { value: huarique|null, at: number }
  const inFlight = new Map(); // id -> Promise<huarique|null>
  const version = ref(0); // bumped on invalidation so views can react if they need to

  function cached(id, now) {
    const entry = entries.get(id);
    return entry && now - entry.at < CATALOG_TTL_MS ? entry : null;
  }

  /** @returns {Promise<object|null>} the huarique, or null if Business answers 404. */
  async function get(id, { now = Date.now(), force = false } = {}) {
    if (!force) {
      const hit = cached(id, now);
      if (hit) return hit.value;
      if (inFlight.has(id)) return inFlight.get(id);
    }
    const request = businessService
      .getHuarique(id)
      .then((value) => {
        entries.set(id, { value, at: Date.now() });
        return value;
      })
      .catch((error) => {
        if (error?.status === 404) {
          entries.set(id, { value: null, at: Date.now() });
          return null;
        }
        throw error;
      })
      .finally(() => inFlight.delete(id));
    inFlight.set(id, request);
    return request;
  }

  /**
   * Loads many huariques in parallel.
   * @returns {Promise<{ huariques: Map<string, object>, missingIds: string[], failedIds: string[] }>}
   *   `missingIds`: Business answered 404. `failedIds`: network/5xx errors (worth a retry).
   */
  async function loadMany(ids) {
    const unique = [...new Set(ids)];
    const settled = await Promise.allSettled(unique.map((id) => get(id)));
    const huariques = new Map();
    const missingIds = [];
    const failedIds = [];
    settled.forEach((result, index) => {
      const id = unique[index];
      if (result.status === 'rejected') failedIds.push(id);
      else if (result.value === null) missingIds.push(id);
      else huariques.set(id, result.value);
    });
    return { huariques, missingIds, failedIds };
  }

  function invalidate(id) {
    if (id) entries.delete(id);
    else entries.clear();
    version.value += 1;
  }

  return { version, get, loadMany, invalidate };
});
