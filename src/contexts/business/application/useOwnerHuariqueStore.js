import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { businessService } from '../infrastructure/BusinessService.js';
import { toProfilePayload } from '../domain/huariqueForm.js';
import { EMPTY_MENU, OPEN_STATUS } from '../domain/huarique.js';
import { imageLimit, validateImageFile } from '../domain/images.js';

export const CONFLICT_MESSAGE = 'Alguien actualizó este huarique, revisa los cambios.';
export const VISIBILITY_MESSAGE = 'Visible en el Radar en unos segundos.';
const VISIBILITY_NOTICE_MS = 8000;

export const OWNER_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  MISSING: 'missing',
  ERROR: 'error',
});

/**
 * The owner's huarique and menu (W7). Every write sends the `version` last read; the response
 * carries the new one and replaces the stored copy. A 409 means someone else changed the
 * resource: the store reloads it, raises `conflictNotice` and reports `{ conflict: true }` so the
 * form can re-sync with what is now on the server.
 */
export const useOwnerHuariqueStore = defineStore('owner-huarique', () => {
  const huarique = ref(null);
  const menu = ref(EMPTY_MENU);
  const status = ref(OWNER_STATUS.IDLE);
  const error = ref('');
  const saving = ref(false);
  const conflictNotice = ref('');
  const visibilityNotice = ref(false);
  let noticeTimer = null;

  const isOpen = computed(() => Boolean(huarique.value?.isOpen));
  const dishCount = computed(() =>
    menu.value.categories.reduce((sum, c) => sum + c.dishes.length, 0),
  );

  function markVisible() {
    visibilityNotice.value = true;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (visibilityNotice.value = false), VISIBILITY_NOTICE_MS);
  }

  async function fetchAll() {
    const mine = await businessService.getMyHuarique();
    huarique.value = mine;
    menu.value = mine ? await businessService.getMenu(mine.id) : EMPTY_MENU;
    return mine;
  }

  async function load() {
    status.value = OWNER_STATUS.LOADING;
    error.value = '';
    try {
      const mine = await fetchAll();
      status.value = mine ? OWNER_STATUS.READY : OWNER_STATUS.MISSING;
    } catch (cause) {
      error.value = cause?.message ?? 'No pudimos cargar tu huarique.';
      status.value = OWNER_STATUS.ERROR;
    }
  }

  /**
   * Runs a write. Success -> `{ ok: true, value }` and the visibility notice (RNF-08).
   * 409 -> reloads and `{ ok: false, conflict: true }`. Anything else -> `{ ok: false, error }`.
   */
  async function mutate(run, { silent = false } = {}) {
    saving.value = true;
    try {
      const value = await run();
      if (!silent) markVisible();
      return { ok: true, value };
    } catch (cause) {
      if (cause?.status === 409) {
        conflictNotice.value = CONFLICT_MESSAGE;
        try {
          await fetchAll();
        } catch {
          /* the next load will show the real error */
        }
        return { ok: false, conflict: true, error: CONFLICT_MESSAGE };
      }
      return { ok: false, error: cause?.message ?? 'No pudimos guardar los cambios.' };
    } finally {
      saving.value = false;
    }
  }

  function dismissConflict() {
    conflictNotice.value = '';
  }

  // --- huarique ---------------------------------------------------------------------------------

  function saveProfile(form) {
    return mutate(async () => {
      huarique.value = await businessService.updateHuarique(
        huarique.value.id,
        toProfilePayload(form),
        huarique.value.version,
      );
      return huarique.value;
    });
  }

  /** Open/closed switch: PATCH open-status with the version we hold. */
  function toggleOpen() {
    const target = huarique.value.isOpen ? OPEN_STATUS.CLOSED : OPEN_STATUS.OPEN;
    return mutate(async () => {
      huarique.value = await businessService.setOpenStatus(
        huarique.value.id,
        target,
        huarique.value.version,
      );
      return huarique.value;
    });
  }

  // --- menu ---------------------------------------------------------------------------------------

  function saveMenu(categories) {
    return mutate(async () => {
      menu.value = await businessService.replaceMenu(
        huarique.value.id,
        categories,
        menu.value.version,
      );
      return menu.value;
    });
  }

  function setDishPrice(dishId, price) {
    return mutate(async () => {
      menu.value = await businessService.setDishPrice(
        huarique.value.id,
        dishId,
        price,
        menu.value.version,
      );
      return menu.value;
    });
  }

  function setDishAvailability(dishId, available) {
    return mutate(async () => {
      menu.value = await businessService.setDishAvailability(
        huarique.value.id,
        dishId,
        available,
        menu.value.version,
      );
      return menu.value;
    });
  }

  // --- images ---------------------------------------------------------------------------------------
  // The image endpoints do not return the new version, so the owner resource is read back after.

  async function refreshAfterImage(dishId) {
    if (dishId) menu.value = await businessService.getMenu(huarique.value.id);
    else huarique.value = await businessService.getMyHuarique();
  }

  function imagesOf(dishId) {
    if (!dishId) return huarique.value.images;
    for (const category of menu.value.categories) {
      const dish = category.dishes.find((d) => d.id === dishId);
      if (dish) return dish.images;
    }
    return [];
  }

  async function uploadImage(file, { dishId = null, replaceId = null } = {}) {
    const invalid = validateImageFile(file);
    if (invalid) return { ok: false, error: invalid };
    if (!replaceId && imagesOf(dishId).length >= imageLimit({ dish: Boolean(dishId) })) {
      return {
        ok: false,
        error: `Alcanzaste el máximo de ${imageLimit({ dish: Boolean(dishId) })} fotos.`,
      };
    }
    return mutate(async () => {
      const image = await businessService.uploadImage(huarique.value.id, file, {
        dishId,
        replaceId,
      });
      await refreshAfterImage(dishId);
      return image;
    });
  }

  function deleteImage(imageId, { dishId = null } = {}) {
    return mutate(async () => {
      await businessService.deleteImage(huarique.value.id, imageId, { dishId });
      await refreshAfterImage(dishId);
    });
  }

  function reset() {
    clearTimeout(noticeTimer);
    huarique.value = null;
    menu.value = EMPTY_MENU;
    status.value = OWNER_STATUS.IDLE;
    error.value = '';
    conflictNotice.value = '';
    visibilityNotice.value = false;
  }

  return {
    huarique,
    menu,
    status,
    error,
    saving,
    conflictNotice,
    visibilityNotice,
    isOpen,
    dishCount,
    load,
    saveProfile,
    toggleOpen,
    saveMenu,
    setDishPrice,
    setDishAvailability,
    uploadImage,
    deleteImage,
    dismissConflict,
    reset,
  };
});
