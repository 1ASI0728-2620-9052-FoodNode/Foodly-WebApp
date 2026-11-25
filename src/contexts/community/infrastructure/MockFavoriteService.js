import { addUnique, removeId } from '../domain/favorites.js';

/**
 * localStorage adapter (VITE_MOCK_COMMUNITY=true). One list per user, so two accounts in the same
 * browser keep separate favorites. Same interface as FavoriteService.
 */
export class MockFavoriteService {
  /**
   * @param {{ getUserId: () => string|null, storage?: Storage }} options
   */
  constructor({ getUserId, storage = globalThis.localStorage }) {
    this.getUserId = getUserId;
    this.storage = storage;
  }

  #key() {
    return `foodly.community.favorites.${this.getUserId() ?? 'anonymous'}`;
  }

  #read() {
    try {
      const parsed = JSON.parse(this.storage.getItem(this.#key()) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  #write(ids) {
    try {
      this.storage.setItem(this.#key(), JSON.stringify(ids));
    } catch {
      /* storage unavailable: favorites last for this page load only */
    }
  }

  async list() {
    return this.#read();
  }

  async add(huariqueId) {
    this.#write(addUnique(this.#read(), huariqueId));
  }

  async remove(huariqueId) {
    this.#write(removeId(this.#read(), huariqueId));
  }
}
