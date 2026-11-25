import { FavoriteService } from './FavoriteService.js';
import { MockFavoriteService } from './MockFavoriteService.js';

/** Picks the adapter: mock (localStorage) while Community has no API, HTTP otherwise. */
export function createFavoriteService({ mock, getUserId }) {
  return mock ? new MockFavoriteService({ getUserId }) : new FavoriteService();
}
