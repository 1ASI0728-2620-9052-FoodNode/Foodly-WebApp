import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { OWNER_STATUS, useOwnerHuariqueStore } from './useOwnerHuariqueStore.js';

/**
 * Shared start-up of every owner screen: loads the huarique once and sends owners who have not
 * registered one to the onboarding.
 */
export function useOwnerPage() {
  const owner = useOwnerHuariqueStore();
  const router = useRouter();

  async function ensureLoaded({ force = false } = {}) {
    if (force || owner.status === OWNER_STATUS.IDLE || owner.status === OWNER_STATUS.ERROR) {
      await owner.load();
    }
    if (owner.status === OWNER_STATUS.MISSING) await router.replace({ name: 'owner-onboarding' });
  }

  onMounted(() => ensureLoaded());

  return { owner, ensureLoaded };
}
