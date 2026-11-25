/** Roles issued by Foodly-IAM-Service (enum `Role`). Values must match the backend exactly. */
export const ROLES = Object.freeze({
  EXPLORER: 'GASTRONOMIC_EXPLORER',
  OWNER: 'HUARIQUE_OWNER',
});

export const ROLE_LABELS = Object.freeze({
  [ROLES.EXPLORER]: 'Explorador Gastronómico',
  [ROLES.OWNER]: 'Dueño de Huarique',
});

/** Where each role lands when it needs a "home" (never decided by the owner's huarique state). */
export const ROLE_HOME = Object.freeze({
  [ROLES.EXPLORER]: '/radar',
  [ROLES.OWNER]: '/owner/dashboard',
});

export function isKnownRole(role) {
  return Object.values(ROLES).includes(role);
}

/** Accepts `ROLE_HUARIQUE_OWNER` too, in case a gateway or a future IAM version adds the prefix. */
export function normalizeRole(raw) {
  if (typeof raw !== 'string') return null;
  const role = raw.startsWith('ROLE_') ? raw.slice(5) : raw;
  return isKnownRole(role) ? role : null;
}
