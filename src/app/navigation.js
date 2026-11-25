import { ROLES } from '../contexts/iam/domain/roles.js';

/** Main navigation per role (informe 6.1): top bar on desktop, bottom bar under 768px. */
export const NAV_ITEMS = Object.freeze({
  [ROLES.EXPLORER]: [
    { to: '/radar', label: 'Radar H3', icon: 'radar' },
    { to: '/favorites', label: 'Favoritos', icon: 'heart' },
    { to: '/messages', label: 'Mensajes', icon: 'message' },
    { to: '/profile', label: 'Perfil', icon: 'user' },
  ],
  [ROLES.OWNER]: [
    { to: '/owner/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/owner/reservations', label: 'Reservas', icon: 'calendar' },
    { to: '/owner/menu', label: 'Mi Menú', icon: 'book' },
    { to: '/owner/gallery', label: 'Galería', icon: 'image' },
    { to: '/owner/profile', label: 'Perfil', icon: 'user' },
  ],
});

export const BRAND_NAMES = Object.freeze({
  [ROLES.EXPLORER]: 'Foodly',
  [ROLES.OWNER]: 'Foodly Admin',
});
