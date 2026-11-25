import { radarService } from '../infrastructure/RadarService.js';
import { enrichLocations } from './enrichLocations.js';
import { useHuariqueCatalogStore } from '../../business/application/useHuariqueCatalogStore.js';

/**
 * Radar search completed with Business data. Shared by the Radar screen and by Lía's chat
 * (which needs the same nearby huariques to turn her text recommendations into cards).
 * Requires an active Pinia.
 *
 * @returns {Promise<{ locations: object[], items: object[], missingCount: number, failedCount: number }>}
 */
export async function searchNearby({ latitude, longitude, kRing }) {
  const locations = await radarService.search({ latitude, longitude, kRing });
  const catalog = useHuariqueCatalogStore();
  const enriched = await enrichLocations(locations, catalog.loadMany);
  return { locations, ...enriched };
}
