import { ref, toValue, watch } from 'vue';
import { useHuariqueCatalogStore } from './useHuariqueCatalogStore.js';
import { businessService } from '../infrastructure/BusinessService.js';
import { EMPTY_MENU } from '../domain/huarique.js';

export const DETAIL_STATUS = Object.freeze({
  LOADING: 'loading',
  READY: 'ready',
  NOT_FOUND: 'not-found',
  ERROR: 'error',
});

/**
 * Loads a huarique and its menu in parallel (W3). `id` can be a ref or a getter.
 * A 404 on the huarique is its own state; a missing menu is just an empty menu.
 */
export function useHuariqueDetail(id) {
  const catalog = useHuariqueCatalogStore();
  const status = ref(DETAIL_STATUS.LOADING);
  const huarique = ref(null);
  const menu = ref(EMPTY_MENU);
  let seq = 0;

  async function load() {
    const current = ++seq;
    status.value = DETAIL_STATUS.LOADING;
    try {
      const [loadedHuarique, loadedMenu] = await Promise.all([
        catalog.get(toValue(id)),
        businessService.getMenu(toValue(id)),
      ]);
      if (current !== seq) return;
      huarique.value = loadedHuarique;
      menu.value = loadedMenu;
      status.value = loadedHuarique ? DETAIL_STATUS.READY : DETAIL_STATUS.NOT_FOUND;
    } catch {
      if (current !== seq) return;
      status.value = DETAIL_STATUS.ERROR;
    }
  }

  watch(() => toValue(id), load, { immediate: true });

  return { status, huarique, menu, reload: load };
}
