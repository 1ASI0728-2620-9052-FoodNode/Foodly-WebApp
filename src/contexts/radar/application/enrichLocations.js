/**
 * Radar returns ids, coordinates and distance; names, photos, cuisine and open state live in Business.
 * Completes each Radar location with its huarique.
 *
 * - Locations whose huarique Business no longer has (404) are dropped: nothing useful to show.
 * - Locations whose lookup failed for another reason are dropped too, but reported in
 *   `failedCount` so the caller can warn that the list may be incomplete.
 * - Order (by distance, as Radar sorted it) is preserved.
 *
 * @param {{ huariqueId: string, distanceMeters: number }[]} locations
 * @param {(ids: string[]) => Promise<{ huariques: Map<string, object>, missingIds: string[], failedIds: string[] }>} loadMany
 */
export async function enrichLocations(locations, loadMany) {
  if (locations.length === 0) return { items: [], missingCount: 0, failedCount: 0 };

  const { huariques, missingIds, failedIds } = await loadMany(locations.map((l) => l.huariqueId));
  const items = locations
    .filter((location) => huariques.has(location.huariqueId))
    .map((location) => ({ ...location, huarique: huariques.get(location.huariqueId) }));

  return { items, missingCount: missingIds.length, failedCount: failedIds.length };
}
