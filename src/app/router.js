import { createRouter, createWebHistory } from 'vue-router';
import { ROLES } from '../contexts/iam/domain/roles.js';
import { installGuards } from './guards.js';

const MainLayout = () => import('./layouts/MainLayout.vue');
const AuthLayout = () => import('./layouts/AuthLayout.vue');

export const routes = [
  { path: '/', name: 'root', component: { render: () => null } }, // always redirected by the guard
  {
    path: '/login',
    component: AuthLayout,
    meta: { public: true, guestOnly: true },
    children: [
      {
        path: '',
        name: 'login',
        component: () => import('./views/LoginView.vue'),
        meta: { title: 'Iniciar sesión', public: true, guestOnly: true },
      },
    ],
  },

  // Explorer
  {
    path: '/',
    component: MainLayout,
    meta: { role: ROLES.EXPLORER },
    children: [
      {
        path: 'radar',
        name: 'radar',
        component: () => import('../contexts/radar/interfaces/RadarView.vue'),
        meta: { title: 'Radar H3', role: ROLES.EXPLORER },
      },
      {
        path: 'favorites',
        name: 'favorites',
        component: () => import('../contexts/community/interfaces/FavoritesView.vue'),
        meta: { title: 'Favoritos', role: ROLES.EXPLORER },
      },
      {
        path: 'messages',
        name: 'messages',
        component: () => import('../contexts/messaging/interfaces/MessagesView.vue'),
        meta: { title: 'Mensajes', role: ROLES.EXPLORER },
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('../contexts/iam/interfaces/ProfileView.vue'),
        meta: { title: 'Perfil', role: ROLES.EXPLORER },
      },
    ],
  },

  // Owner ("Foodly Admin")
  {
    path: '/owner',
    component: MainLayout,
    meta: { role: ROLES.OWNER },
    children: [
      { path: '', redirect: '/owner/dashboard' },
      {
        path: 'onboarding',
        name: 'owner-onboarding',
        component: () => import('../contexts/business/interfaces/OwnerOnboardingView.vue'),
        meta: { title: 'Registra tu huarique', role: ROLES.OWNER },
      },
      {
        path: 'dashboard',
        name: 'owner-dashboard',
        component: () => import('../contexts/business/interfaces/OwnerDashboardView.vue'),
        meta: { title: 'Dashboard', role: ROLES.OWNER },
      },
      {
        path: 'reservations',
        name: 'owner-reservations',
        component: () => import('../contexts/reservation/interfaces/OwnerReservationsView.vue'),
        meta: { title: 'Reservas', role: ROLES.OWNER },
      },
      {
        path: 'menu',
        name: 'owner-menu',
        component: () => import('../contexts/business/interfaces/OwnerMenuView.vue'),
        meta: { title: 'Mi Menú', role: ROLES.OWNER },
      },
      {
        path: 'gallery',
        name: 'owner-gallery',
        component: () => import('../contexts/business/interfaces/OwnerGalleryView.vue'),
        meta: { title: 'Galería', role: ROLES.OWNER },
      },
      {
        path: 'profile',
        name: 'owner-profile',
        component: () => import('../contexts/iam/interfaces/ProfileView.vue'),
        meta: { title: 'Perfil', role: ROLES.OWNER },
      },
    ],
  },

  {
    path: '/403',
    name: 'forbidden',
    component: () => import('./views/ForbiddenView.vue'),
    meta: { title: 'Acceso denegado', public: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('./views/NotFoundView.vue'),
    meta: { title: 'Página no encontrada', public: true },
  },
];

export function createAppRouter(history = createWebHistory()) {
  const router = createRouter({
    history,
    routes,
    scrollBehavior: () => ({ top: 0 }),
  });
  installGuards(router);
  router.afterEach((to) => {
    document.title = to.meta?.title ? `${to.meta.title} · Foodly` : 'Foodly';
  });
  return router;
}
