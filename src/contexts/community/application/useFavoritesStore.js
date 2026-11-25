import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { createFavoriteService } from '../infrastructure/favoriteServiceFactory.js';
import { addUnique, removeId } from '../domain/favorites.js';
import { useAuthStore } from '../../iam/application/useAuthStore.js';
import { MOCK_COMMUNITY } from '../../../shared/config/index.js';

const service = createFavoriteService({
  mock: MOCK_COMMUNITY,
  getUserId: () => useAuthStore().profile?.id ?? null,
});

/** Favorites of the signed-in explorer. Toggles are optimistic and revert if the service fails. */
export const useFavoritesStore = defineStore('favorites', () => {
  const ids = ref([]);
  const loaded = ref(false);
  const loading = ref(false);
  const error = ref('');

  const count = computed(() => ids.value.length);
  const isFavorite = (huariqueId) => ids.value.includes(huariqueId);

  async function load() {
    loading.value = true;
    error.value = '';
    try {
      ids.value = await service.list();
      loaded.value = true;
    } catch (cause) {
      error.value = cause?.message ?? 'No pudimos cargar tus favoritos.';
    } finally {
      loading.value = false;
    }
  }

  /** @returns {Promise<boolean>} false when the service failed and the change was reverted */
  async function toggle(huariqueId) {
    const before = ids.value;
    const adding = !before.includes(huariqueId);
    ids.value = adding ? addUnique(before, huariqueId) : removeId(before, huariqueId);
    try {
      await (adding ? service.add(huariqueId) : service.remove(huariqueId));
      return true;
    } catch (cause) {
      ids.value = before;
      error.value = cause?.message ?? 'No pudimos actualizar tus favoritos.';
      return false;
    }
  }

  function reset() {
    ids.value = [];
    loaded.value = false;
    error.value = '';
  }

  return { ids, loaded, loading, error, count, isFavorite, load, toggle, reset };
});
