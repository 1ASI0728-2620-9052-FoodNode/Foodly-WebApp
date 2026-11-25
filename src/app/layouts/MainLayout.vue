<script setup>
import { computed } from 'vue';
import { useAuthStore } from '../../contexts/iam/application/useAuthStore.js';
import { BRAND_NAMES, NAV_ITEMS } from '../navigation.js';
import AppIcon from '../../shared/ui/AppIcon.vue';

const auth = useAuthStore();

const items = computed(() => NAV_ITEMS[auth.role] ?? []);
const brand = computed(() => BRAND_NAMES[auth.role] ?? 'Foodly');
</script>

<template>
  <div class="main-layout">
    <header class="topbar">
      <div class="topbar__inner">
        <RouterLink class="topbar__brand" :to="items[0]?.to ?? '/'">
          <span class="topbar__logo"><AppIcon name="utensils" :size="22" /></span>
          {{ brand }}
        </RouterLink>
        <nav class="topbar__nav" aria-label="Navegación principal">
          <RouterLink v-for="item in items" :key="item.to" :to="item.to" class="nav-link">
            <AppIcon :name="item.icon" :size="20" />
            {{ item.label }}
          </RouterLink>
        </nav>
      </div>
    </header>

    <main id="main" class="main-layout__content">
      <RouterView />
    </main>

    <nav class="bottombar" aria-label="Navegación principal">
      <RouterLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="nav-link nav-link--stacked"
      >
        <AppIcon :name="item.icon" :size="22" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.main-layout {
  min-height: 100vh;
  /* Room for the bottom bar on small screens. */
  padding-bottom: calc(var(--bottombar-height) + env(safe-area-inset-bottom));
}

.main-layout__content {
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-5) var(--space-4);
}

.topbar {
  display: none;
  position: sticky;
  top: 0;
  z-index: var(--z-nav);
  background: var(--color-white);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

.topbar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  max-width: var(--content-max-width);
  height: var(--topbar-height);
  margin: 0 auto;
  padding: 0 var(--space-4);
}

.topbar__brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch-target);
  font-size: var(--text-lg);
  font-weight: 800;
  color: var(--color-brown);
  text-decoration: none;
}

.topbar__logo {
  display: inline-flex;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: var(--color-white);
}

.topbar__nav {
  display: flex;
  gap: var(--space-1);
}

.nav-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--touch-target);
  min-width: var(--touch-target);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-muted);
  text-decoration: none;
}

.nav-link:hover {
  background: var(--color-surface-soft);
}

.nav-link.router-link-active {
  background: var(--color-surface-soft);
  color: var(--color-primary);
  box-shadow: inset 0 -3px 0 var(--color-primary);
}

.bottombar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: var(--z-nav);
  display: flex;
  height: calc(var(--bottombar-height) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--color-white);
  border-top: 1px solid var(--color-border);
  box-shadow: 0 -4px 16px rgb(73 41 6 / 8%);
}

.nav-link--stacked {
  flex: 1;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-1);
  border-radius: 0;
  font-size: 0.6875rem;
}

.nav-link--stacked.router-link-active {
  box-shadow: inset 0 3px 0 var(--color-primary);
}

@media (min-width: 768px) {
  .topbar {
    display: block;
  }

  .bottombar {
    display: none;
  }

  .main-layout {
    padding-bottom: 0;
  }

  .main-layout__content {
    padding: var(--space-6) var(--space-5);
  }
}
</style>
