import { ROLE_HOME } from '../contexts/iam/domain/roles.js';
import { useAuthStore } from '../contexts/iam/application/useAuthStore.js';

/**
 * Pure navigation rule, easy to test. `to.meta` is read as:
 * - `public: true`  reachable without a session (login, 403, 404).
 * - `role: <ROLE>`  only that role may enter; any other authenticated role gets 403.
 * - `guestOnly: true` for login: an authenticated user is sent to their home instead.
 *
 * @returns {true | { name?: string, path?: string, query?: object }} `true` lets it through,
 *   anything else is the location to redirect to.
 */
export function resolveNavigation(to, { isAuthenticated, role }) {
  const meta = to.meta ?? {};

  if (to.path === '/') {
    return isAuthenticated ? { path: ROLE_HOME[role] } : { name: 'login' };
  }

  if (meta.guestOnly && isAuthenticated) return { path: ROLE_HOME[role] };
  if (meta.public) return true;

  if (!isAuthenticated) return { name: 'login' };
  if (meta.role && meta.role !== role) return { name: 'forbidden' };
  return true;
}

export function installGuards(router) {
  router.beforeEach((to) => {
    const auth = useAuthStore();
    // Closes the session first if the token expired while the tab was idle.
    const isAuthenticated = auth.ensureValidSession();
    const decision = resolveNavigation(to, { isAuthenticated, role: auth.role });

    if (decision?.name === 'login' && auth.logoutReason) {
      return { name: 'login', query: { reason: auth.logoutReason } };
    }
    return decision;
  });
}
