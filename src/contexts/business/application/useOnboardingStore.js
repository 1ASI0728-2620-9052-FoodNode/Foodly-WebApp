import { computed, reactive, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { businessService } from '../infrastructure/BusinessService.js';
import {
  ONBOARDING_STEPS,
  emptyHuariqueForm,
  toProfilePayload,
  toStarMenuCategories,
} from '../domain/huariqueForm.js';
import { OPEN_STATUS } from '../domain/huarique.js';
import { useAuthStore } from '../../iam/application/useAuthStore.js';

const DRAFT_PREFIX = 'foodly.owner.onboarding.draft.';

export const PUBLISH_STAGES = Object.freeze({
  REGISTER: 'register',
  MENU: 'menu',
  OPEN: 'open',
});

const STAGE_ERRORS = {
  [PUBLISH_STAGES.REGISTER]: 'No pudimos registrar tu huarique.',
  [PUBLISH_STAGES.MENU]: 'Tu huarique se registró, pero no pudimos guardar tus platillos.',
  [PUBLISH_STAGES.OPEN]: 'Tu huarique se registró, pero no pudimos activarlo en el Radar.',
};

const freshProgress = () => ({ huariqueId: null, version: null, menuDone: false });

/**
 * Onboarding wizard (W6, 3 steps) with a draft kept in localStorage per owner.
 *
 * Publishing is three calls that must run in this order, because Business always creates the
 * huarique CLOSED and the menu needs the huarique to exist:
 *   1. POST  /business-api/huariques            -> huarique (version v)
 *   2. PUT   /business-api/huariques/{id}/menu  -> first menu: `version` omitted
 *   3. PATCH /business-api/huariques/{id}/open-status { OPEN, version: v }
 * The stage already completed is remembered in the draft, so a retry after a failure in step 2 or 3
 * never POSTs again (that would answer 409: the owner already has a huarique).
 */
export const useOnboardingStore = defineStore('onboarding', () => {
  const form = reactive(emptyHuariqueForm());
  const step = ref(1);
  const attempted = ref({}); // step -> true once the user tried to leave it
  const progress = reactive(freshProgress());
  const publishing = ref(false);
  const error = ref('');
  const failedStage = ref(null);
  const alreadyRegistered = ref(false);
  const hasDraft = ref(false);
  let restoring = false;

  const storageKey = () => `${DRAFT_PREFIX}${useAuthStore().profile?.id ?? 'anonymous'}`;

  // --- validation ------------------------------------------------------------------------------

  const stepResult = (n) => ONBOARDING_STEPS[n - 1].validate(form);
  const currentErrors = computed(() =>
    attempted.value[step.value] ? stepResult(step.value).errors : {},
  );
  const progressPercent = computed(() =>
    Math.round(((step.value - 1) / ONBOARDING_STEPS.length) * 100),
  );

  // --- navigation ------------------------------------------------------------------------------

  /** Moves forward only if the current step is valid. */
  function next() {
    attempted.value = { ...attempted.value, [step.value]: true };
    if (!stepResult(step.value).valid) return false;
    if (step.value < ONBOARDING_STEPS.length) step.value += 1;
    return true;
  }

  function back() {
    if (step.value > 1) step.value -= 1;
  }

  // --- draft -----------------------------------------------------------------------------------

  function saveDraft() {
    if (restoring) return;
    try {
      localStorage.setItem(
        storageKey(),
        JSON.stringify({ form: { ...form }, step: step.value, progress: { ...progress } }),
      );
      hasDraft.value = true;
    } catch {
      /* storage unavailable: the wizard still works, only without a draft */
    }
  }

  function restoreDraft() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()) ?? 'null');
      if (!saved?.form) return false;
      restoring = true;
      Object.assign(form, emptyHuariqueForm(), saved.form);
      Object.assign(progress, freshProgress(), saved.progress);
      step.value = Math.min(Math.max(Number(saved.step) || 1, 1), ONBOARDING_STEPS.length);
      hasDraft.value = true;
      return true;
    } catch {
      return false;
    } finally {
      restoring = false;
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(storageKey());
    } catch {
      /* nothing to clear */
    }
    hasDraft.value = false;
  }

  function reset() {
    restoring = true;
    Object.assign(form, emptyHuariqueForm());
    Object.assign(progress, freshProgress());
    step.value = 1;
    attempted.value = {};
    error.value = '';
    failedStage.value = null;
    alreadyRegistered.value = false;
    publishing.value = false;
    restoring = false;
  }

  watch([() => ({ ...form }), step, () => ({ ...progress })], () => saveDraft(), { deep: true });

  // --- publishing ------------------------------------------------------------------------------

  /** @returns {Promise<{ ok: boolean, alreadyRegistered?: boolean, invalidStep?: number }>} */
  async function publish() {
    for (const { id } of ONBOARDING_STEPS) {
      attempted.value = { ...attempted.value, [id]: true };
      if (!stepResult(id).valid) {
        step.value = id;
        return { ok: false, invalidStep: id };
      }
    }

    publishing.value = true;
    error.value = '';
    failedStage.value = null;
    let stage = PUBLISH_STAGES.REGISTER;
    try {
      if (!progress.huariqueId) {
        const created = await businessService.registerHuarique(toProfilePayload(form));
        progress.huariqueId = created.id;
        progress.version = created.version;
      }
      stage = PUBLISH_STAGES.MENU;
      if (!progress.menuDone) {
        await businessService.replaceMenu(
          progress.huariqueId,
          toStarMenuCategories(form.dishes),
          null,
        );
        progress.menuDone = true;
      }
      stage = PUBLISH_STAGES.OPEN;
      await openWithRetry();

      clearDraft();
      return { ok: true };
    } catch (cause) {
      if (stage === PUBLISH_STAGES.REGISTER && cause?.status === 409) {
        alreadyRegistered.value = true;
        clearDraft();
        return { ok: false, alreadyRegistered: true };
      }
      failedStage.value = stage;
      error.value = `${STAGE_ERRORS[stage]} ${cause?.message ?? ''}`.trim();
      return { ok: false };
    } finally {
      publishing.value = false;
    }
  }

  /** PATCH open-status; a stale version (409) is refreshed from the server once. */
  async function openWithRetry() {
    try {
      await businessService.setOpenStatus(progress.huariqueId, OPEN_STATUS.OPEN, progress.version);
    } catch (cause) {
      if (cause?.status !== 409) throw cause;
      const current = await businessService.getMyHuarique();
      if (!current) throw cause;
      progress.version = current.version;
      await businessService.setOpenStatus(progress.huariqueId, OPEN_STATUS.OPEN, current.version);
    }
  }

  return {
    form,
    step,
    attempted,
    progress,
    publishing,
    error,
    failedStage,
    alreadyRegistered,
    hasDraft,
    currentErrors,
    progressPercent,
    stepResult,
    next,
    back,
    saveDraft,
    restoreDraft,
    clearDraft,
    reset,
    publish,
  };
});
