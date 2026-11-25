import { httpClient as defaultClient } from '../../../shared/http/index.js';
import { normalizeFavorites } from '../domain/favorites.js';

/**
 * HTTP adapter for favorites (informe 5.4.2), through Kong prefix /community.
 * Interface shared with MockFavoriteService: { list(), add(id), remove(id) } -> string[] of ids.
 */
export class FavoriteService {
  constructor(client = defaultClient) {
    this.client = client;
  }

  /** GET /community/favorites/me */
  async list() {
    return normalizeFavorites(await this.client.get('/community/favorites/me'));
  }

  /** POST /community/favorites/{huariqueId}. Adding an existing favorite (409) is not an error. */
  async add(huariqueId) {
    try {
      await this.client.post(`/community/favorites/${encodeURIComponent(huariqueId)}`);
    } catch (error) {
      if (error?.status !== 409) throw error;
    }
  }

  /** DELETE /community/favorites/{huariqueId}. Removing a missing favorite (404) is not an error. */
  async remove(huariqueId) {
    try {
      await this.client.delete(`/community/favorites/${encodeURIComponent(huariqueId)}`);
    } catch (error) {
      if (error?.status !== 404) throw error;
    }
  }
}
