<script setup>
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { DETAIL_STATUS, useHuariqueDetail } from '../application/useHuariqueDetail.js';
import { CUISINE_TYPES, DAY_LABELS, sortedOpeningHours } from '../domain/huarique.js';
import FavoriteButton from '../../community/interfaces/FavoriteButton.vue';
import { useFavoritesStore } from '../../community/application/useFavoritesStore.js';
import { useLiaDrawerStore } from '../../messaging/application/useLiaDrawerStore.js';
import { useRadarStore } from '../../radar/application/useRadarStore.js';
import { googleMapsDirectionsUrl } from '../../../shared/geo/distance.js';
import { formatPriceRange, formatSoles } from '../../../shared/utils/format.js';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppCard from '../../../shared/ui/AppCard.vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';
import AppMap from '../../../shared/ui/AppMap.vue';
import AppSkeleton from '../../../shared/ui/AppSkeleton.vue';
import EmptyState from '../../../shared/ui/EmptyState.vue';
import ErrorState from '../../../shared/ui/ErrorState.vue';
import StatusBadge from '../../../shared/ui/StatusBadge.vue';

const route = useRoute();
const { status, huarique, menu, reload } = useHuariqueDetail(() => String(route.params.id));

const favorites = useFavoritesStore();
const liaDrawer = useLiaDrawerStore();
const radar = useRadarStore();
if (!favorites.loaded) favorites.load();

const activeImage = ref(0);
const hours = computed(() =>
  huarique.value ? sortedOpeningHours(huarique.value.openingHours) : [],
);
const mapMarkers = computed(() =>
  huarique.value
    ? [
        {
          id: huarique.value.id,
          kind: 'huarique',
          label: huarique.value.name,
          ...huarique.value.location,
        },
      ]
    : [],
);
</script>

<template>
  <section class="detail">
    <RouterLink class="detail__back" :to="{ name: 'radar' }">
      <AppIcon name="radar" :size="18" /> Volver al Radar
    </RouterLink>

    <div
      v-if="status === DETAIL_STATUS.LOADING"
      class="detail__loading"
      role="status"
      aria-busy="true"
    >
      <span class="sr-only">Cargando huarique…</span>
      <AppSkeleton width="60%" height="2rem" />
      <AppSkeleton height="260px" />
      <AppSkeleton width="80%" />
    </div>

    <ErrorState v-else-if="status === DETAIL_STATUS.ERROR" @retry="reload" />

    <EmptyState
      v-else-if="status === DETAIL_STATUS.NOT_FOUND"
      icon="store"
      title="Este huarique ya no está disponible"
      description="Pudo ser retirado por su dueño. Vuelve al Radar para ver otros."
    />

    <template v-else>
      <header class="detail__header">
        <div>
          <h1 class="detail__title">{{ huarique.name }}</h1>
          <p class="detail__meta">
            {{ CUISINE_TYPES[huarique.cuisineType] ?? huarique.cuisineType }} ·
            {{ formatPriceRange(huarique.priceMin, huarique.priceMax) }} · {{ huarique.address }}
          </p>
          <ul v-if="huarique.tags.length" class="detail__tags" aria-label="Etiquetas">
            <li v-for="tag in huarique.tags" :key="tag">{{ tag }}</li>
          </ul>
        </div>
        <div class="detail__status">
          <StatusBadge :status="huarique.isOpen ? 'open' : 'closed'" />
          <FavoriteButton :huarique-id="huarique.id" :huarique-name="huarique.name" />
        </div>
      </header>

      <div class="detail__actions">
        <RouterLink
          v-slot="{ navigate }"
          :to="{ name: 'reserve', params: { id: huarique.id } }"
          custom
        >
          <AppButton @click="navigate">
            <AppIcon name="calendar" :size="18" /> Reservar Mesa con Lía
          </AppButton>
        </RouterLink>
        <AppButton
          variant="secondary"
          @click="
            liaDrawer.open({
              huariqueId: huarique.id,
              huariqueName: huarique.name,
              location: radar.location,
            })
          "
        >
          <AppIcon name="message" :size="18" /> Preguntar a Lía
        </AppButton>
        <a
          class="detail__route"
          :href="googleMapsDirectionsUrl(huarique.location)"
          target="_blank"
          rel="noopener noreferrer"
        >
          <AppIcon name="mapPin" :size="18" /> Ir en Ruta
          <span class="sr-only">(se abre en Google Maps, en una pestaña nueva)</span>
        </a>
      </div>

      <section aria-labelledby="gallery-title" class="detail__section">
        <h2 id="gallery-title">Galería</h2>
        <div v-if="huarique.images.length" class="gallery">
          <img
            class="gallery__main"
            :src="huarique.images[activeImage].url"
            :alt="`Foto ${activeImage + 1} de ${huarique.name}`"
          />
          <ul v-if="huarique.images.length > 1" class="gallery__thumbs">
            <li v-for="(image, index) in huarique.images" :key="image.id">
              <button
                type="button"
                class="gallery__thumb"
                :class="{ 'gallery__thumb--active': index === activeImage }"
                :aria-label="`Ver foto ${index + 1}`"
                :aria-pressed="index === activeImage"
                @click="activeImage = index"
              >
                <img :src="image.url" alt="" loading="lazy" />
              </button>
            </li>
          </ul>
        </div>
        <p v-else class="detail__muted">Este huarique aún no tiene fotos.</p>
      </section>

      <section aria-labelledby="menu-title" class="detail__section">
        <h2 id="menu-title">Carta</h2>
        <p v-if="menu.categories.length === 0" class="detail__muted">
          Este huarique aún no publicó su carta.
        </p>
        <AppCard v-for="category in menu.categories" :key="category.id" class="menu-category">
          <h3>{{ category.name }}</h3>
          <ul class="menu-category__dishes">
            <li v-for="dish in category.dishes" :key="dish.id" class="dish">
              <div class="dish__info">
                <p class="dish__name">{{ dish.name }}</p>
                <p v-if="dish.description" class="dish__description">{{ dish.description }}</p>
                <StatusBadge :status="dish.available ? 'available' : 'unavailable'" />
              </div>
              <p class="dish__price">{{ formatSoles(dish.price) }}</p>
            </li>
          </ul>
        </AppCard>
      </section>

      <div class="detail__columns">
        <section aria-labelledby="hours-title" class="detail__section">
          <h2 id="hours-title">Horarios</h2>
          <p v-if="hours.length === 0" class="detail__muted">Sin horarios publicados.</p>
          <dl v-else class="hours">
            <div v-for="slot in hours" :key="`${slot.day}-${slot.opensAt}`" class="hours__row">
              <dt>{{ DAY_LABELS[slot.day] }}</dt>
              <dd>{{ slot.opensAt }} – {{ slot.closesAt }}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="map-title" class="detail__section">
          <h2 id="map-title">Ubicación</h2>
          <div class="detail__map">
            <AppMap
              :center="huarique.location"
              :zoom="16"
              :markers="mapMarkers"
              :interactive="false"
              :aria-label="`Mapa con la ubicación de ${huarique.name}`"
            />
          </div>
        </section>
      </div>

      <section aria-labelledby="reviews-title" class="detail__section">
        <h2 id="reviews-title">Reseñas verificadas</h2>
        <AppCard>
          <EmptyState
            icon="shieldCheck"
            title="Aún no hay reseñas"
            description="Las reseñas de comensales con reserva verificada aparecerán aquí."
          />
        </AppCard>
      </section>
    </template>
  </section>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.detail__back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch-target);
  font-weight: 600;
}

.detail__loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.detail__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.detail__title {
  font-size: var(--text-3xl);
}

.detail__meta,
.detail__muted {
  color: var(--color-text-muted);
}

.detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
}

.detail__tags li {
  padding: var(--space-1) var(--space-3);
  background: var(--color-surface-soft);
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  font-weight: 600;
}

.detail__status {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.detail__route {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--touch-target);
  padding: var(--space-2) var(--space-5);
  background: var(--color-success);
  border-radius: var(--radius-pill);
  font-weight: 700;
  color: var(--color-white);
  text-decoration: none;
}

.detail__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.detail__section h2 {
  font-size: var(--text-xl);
}

.detail__columns {
  display: grid;
  gap: var(--space-5);
}

@media (min-width: 768px) {
  .detail__columns {
    grid-template-columns: 1fr 1fr;
  }
}

.gallery__main {
  display: block;
  width: 100%;
  max-height: 420px;
  border-radius: var(--radius-lg);
  object-fit: cover;
}

.gallery__thumbs {
  display: flex;
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
  padding: 0;
  overflow-x: auto;
  list-style: none;
}

.gallery__thumb {
  width: 72px;
  height: 72px;
  padding: 0;
  border: 3px solid transparent;
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
}

.gallery__thumb--active {
  border-color: var(--color-primary);
}

.gallery__thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.menu-category h3 {
  margin-bottom: var(--space-3);
}

.menu-category__dishes {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.dish {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
}

.dish__info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
}

.dish__name {
  font-weight: 700;
}

.dish__description {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.dish__price {
  font-weight: 800;
  color: var(--color-primary);
  white-space: nowrap;
}

.hours {
  margin: 0;
}

.hours__row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}

.hours dt {
  font-weight: 600;
}

.hours dd {
  margin: 0;
}

.detail__map {
  height: 240px;
}
</style>
