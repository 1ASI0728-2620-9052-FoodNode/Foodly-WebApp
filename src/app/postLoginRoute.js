import { ROLES, ROLE_HOME } from '../contexts/iam/domain/roles.js';
import { businessService as defaultBusinessService } from '../contexts/business/infrastructure/BusinessService.js';

export const OWNER_ONBOARDING_PATH = '/owner/onboarding';

/**
 * Decides where a freshly authenticated user lands (UF-W1).
 * - Explorer: /radar.
 * - Owner: asks Business for their huarique. 404 (none yet) -> onboarding; found -> dashboard.
 *   If Business cannot be reached the owner still gets in: dashboard, flagged with `degraded`
 *   so the caller can warn that the huarique status could not be verified.
 *
 * Lives in `app/` because it orchestrates two bounded contexts (iam and business).
 *
 * @returns {Promise<{ path: string, degraded: boolean }>}
 */
export async function resolvePostLoginRoute(
  role,
  { businessService = defaultBusinessService } = {},
) {
  if (role !== ROLES.OWNER) return { path: ROLE_HOME[ROLES.EXPLORER], degraded: false };

  try {
    const huarique = await businessService.getMyHuarique();
    return { path: huarique ? ROLE_HOME[ROLES.OWNER] : OWNER_ONBOARDING_PATH, degraded: false };
  } catch {
    return { path: ROLE_HOME[ROLES.OWNER], degraded: true };
  }
}
