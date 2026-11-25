import { watch } from 'vue';
import { httpClient } from '../shared/http/index.js';
import { useAuthStore, LOGOUT_REASONS } from '../contexts/iam/application/useAuthStore.js';

/**
 * Wires the shared HTTP client to the session and keeps the router in sync with it.
 * Called once, after Pinia and the router are installed and before the first navigation.
 */
export function wireSession(router) {
  const auth = useAuthStore();

  httpClient.configure({
    getToken: () => auth.token,
    // A 401 on a request that carried a token means the session is no longer valid.
    onUnauthorized: () => auth.logout(LOGOUT_REASONS.UNAUTHORIZED),
  });

  // Any way of losing the session (401, token expiry, manual logout) ends on /login.
  watch(
    () => auth.isAuthenticated,
    (isAuthenticated) => {
      if (isAuthenticated) return;
      const current = router.currentRoute.value;
      // Before the first navigation (session restore at startup) the guards decide.
      if (current.matched.length === 0 || current.meta?.public) return;
      const reason = auth.consumeLogoutReason();
      router.replace({ name: 'login', query: reason ? { reason } : {} });
    },
  );
}
