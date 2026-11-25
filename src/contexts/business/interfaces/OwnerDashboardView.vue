<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { OWNER_STATUS } from '../application/useOwnerHuariqueStore.js';
import { useOwnerPage } from '../application/useOwnerPage.js';
import {
  formFromHuarique,
  validateIdentity,
  validateOpeningHours,
  validatePricingAndLocation,
} from '../domain/huariqueForm.js';
import IdentityFields from './IdentityFields.vue';
import PricingLocationFields from './PricingLocationFields.vue';
import OpeningHoursEditor from './OpeningHoursEditor.vue';
import OwnerNotices from './OwnerNotices.vue';
import OwnerStatusSwitch from './OwnerStatusSwitch.vue';
import { formatPriceRange } from '../../../shared/utils/format.js';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppCard from '../../../shared/ui/AppCard.vue';
import AppSkeleton from '../../../shared/ui/AppSkeleton.vue';
import ErrorState from '../../../shared/ui/ErrorState.vue';
import { useToast } from '../../../shared/ui/useToast.js';

const { owner, ensureLoaded } = useOwnerPage();
const toast = useToast();

const form = reactive(
  formFromHuarique({
    name: '',
    cuisineType: '',
    tags: [],
    address: '',
    priceMin: 0,
    priceMax: 0,
    location: { latitude: null, longitude: null },
    openingHours: [],
  }),
);
const errors = ref({});

// The form always mirrors the server copy: after a save, a reload or a version conflict.
watch(
  () => owner.huarique,
  (huarique) => {
    if (huarique) Object.assign(form, formFromHuarique(huarique));
    errors.value = {};
  },
  { immediate: true },
);

const stats = computed(() => {
  const h = owner.huarique;
  if (!h) return [];
  return [
    { label: 'Platos en la carta', value: owner.dishCount },
    { label: 'Fotos', value: h.images.length },
    { label: 'Horarios', value: h.openingHours.length },
    { label: 'Rango de precios', value: formatPriceRange(h.priceMin, h.priceMax) },
  ];
});

async function save() {
  const identity = validateIdentity(form);
  const pricing = validatePricingAndLocation(form);
  const hours = validateOpeningHours(form.openingHours);
  errors.value = { ...identity.errors, ...pricing.errors, openingHours: hours };
  // The PUT sends the whole profile, so a half-invalid one is never sent.
  if (!identity.valid || !pricing.valid || hours) {
    toast.warning('Revisa los campos marcados antes de guardar.');
    return;
  }
  const result = await owner.saveProfile(form);
  if (result.ok) toast.success('Cambios guardados.');
  else if (!result.conflict) toast.error(result.error);
}
</script>

<template>
  <section class="dashboard">
    <header>
      <h1 class="dashboard__title">Dashboard</h1>
      <p v-if="owner.huarique" class="dashboard__subtitle">{{ owner.huarique.name }}</p>
    </header>

    <div
      v-if="owner.status === OWNER_STATUS.LOADING || owner.status === OWNER_STATUS.IDLE"
      role="status"
      aria-busy="true"
    >
      <span class="sr-only">Cargando tu huarique…</span>
      <AppSkeleton height="96px" />
      <AppSkeleton height="160px" class="dashboard__gap" />
    </div>

    <ErrorState
      v-else-if="owner.status === OWNER_STATUS.ERROR"
      :message="owner.error"
      @retry="ensureLoaded({ force: true })"
    />

    <template v-else-if="owner.huarique">
      <OwnerNotices />
      <OwnerStatusSwitch />

      <dl class="stats">
        <div v-for="stat in stats" :key="stat.label" class="stats__tile">
          <dt>{{ stat.label }}</dt>
          <dd>{{ stat.value }}</dd>
        </div>
      </dl>

      <AppCard as="section" aria-labelledby="identity-title">
        <form class="section" novalidate @submit.prevent="save">
          <h2 id="identity-title">Identidad y ubicación</h2>
          <IdentityFields :form="form" :errors="errors" />
          <PricingLocationFields :form="form" :errors="errors" />
          <div class="section__actions">
            <AppButton type="submit" :loading="owner.saving">Guardar identidad</AppButton>
          </div>
        </form>
      </AppCard>

      <AppCard as="section" aria-labelledby="hours-title">
        <form class="section" novalidate @submit.prevent="save">
          <h2 id="hours-title">Horarios</h2>
          <OpeningHoursEditor v-model="form.openingHours" :error="errors.openingHours" />
          <div class="section__actions">
            <AppButton type="submit" :loading="owner.saving">Guardar horarios</AppButton>
          </div>
        </form>
      </AppCard>

      <nav class="links" aria-label="Más secciones">
        <RouterLink :to="{ name: 'owner-menu' }">Carta y Precios →</RouterLink>
        <RouterLink :to="{ name: 'owner-gallery' }">Fotos y Galería →</RouterLink>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.dashboard__title {
  font-size: var(--text-2xl);
}

.dashboard__subtitle {
  color: var(--color-text-muted);
}

.dashboard__gap {
  margin-top: var(--space-3);
}

.stats {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  margin: 0;
}

.stats__tile {
  padding: var(--space-4);
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.stats__tile dt {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.stats__tile dd {
  margin: var(--space-1) 0 0;
  font-size: var(--text-xl);
  font-weight: 800;
  color: var(--color-primary);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.section h2 {
  font-size: var(--text-xl);
}

.section__actions {
  display: flex;
  justify-content: flex-end;
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
}

.links a {
  display: inline-flex;
  align-items: center;
  min-height: var(--touch-target);
  font-weight: 700;
}
</style>
