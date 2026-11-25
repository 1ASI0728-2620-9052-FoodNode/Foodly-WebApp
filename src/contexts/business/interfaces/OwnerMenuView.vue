<script setup>
import { ref, watch } from 'vue';
import { OWNER_STATUS } from '../application/useOwnerHuariqueStore.js';
import { useOwnerPage } from '../application/useOwnerPage.js';
import {
  menuToDraft,
  validateMenuDraft,
  draftToCategories,
  newDish,
  newCategory,
} from '../domain/menuDraft.js';
import { parseMoney } from '../domain/huariqueForm.js';
import { MAX_DISH_IMAGES } from '../domain/images.js';
import ImageManager from './ImageManager.vue';
import OwnerNotices from './OwnerNotices.vue';
import { formatSoles } from '../../../shared/utils/format.js';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppCard from '../../../shared/ui/AppCard.vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';
import AppInput from '../../../shared/ui/AppInput.vue';
import AppSkeleton from '../../../shared/ui/AppSkeleton.vue';
import ErrorState from '../../../shared/ui/ErrorState.vue';
import StatusBadge from '../../../shared/ui/StatusBadge.vue';
import { useToast } from '../../../shared/ui/useToast.js';

const { owner, ensureLoaded } = useOwnerPage();
const toast = useToast();

const draft = ref([]);
const errors = ref({});
const priceEdits = ref({}); // dishId -> text typed in the quick price field
const priceErrors = ref({});

// The editor always mirrors the server menu (after a save or a version conflict).
watch(
  () => owner.menu,
  (menu) => {
    draft.value = menuToDraft(menu);
    priceEdits.value = {};
    errors.value = {};
  },
  { immediate: true },
);

async function saveMenu() {
  const validation = validateMenuDraft(draft.value);
  errors.value = validation.errors;
  if (!validation.valid) {
    toast.warning('Revisa los campos marcados antes de guardar la carta.');
    return;
  }
  const result = await owner.saveMenu(draftToCategories(draft.value));
  if (result.ok) toast.success('Carta guardada.');
  else if (!result.conflict) toast.error(result.error);
}

async function savePrice(dish) {
  const price = parseMoney(priceEdits.value[dish.id]);
  if (Number.isNaN(price)) {
    priceErrors.value = { ...priceErrors.value, [dish.id]: 'Ingresa un precio válido en S/.' };
    return;
  }
  priceErrors.value = { ...priceErrors.value, [dish.id]: '' };
  const result = await owner.setDishPrice(dish.id, price);
  if (result.ok) toast.success(`Precio de «${dish.name}» actualizado.`);
  else if (!result.conflict) toast.error(result.error);
}

async function toggleAvailability(dish) {
  const result = await owner.setDishAvailability(dish.id, !dish.available);
  if (!result.ok && !result.conflict) toast.error(result.error);
}

async function uploadDishImage(dish, { file, replaceId }) {
  const result = await owner.uploadImage(file, { dishId: dish.id, replaceId });
  if (result.ok) toast.success('Foto del plato guardada.');
  else if (!result.conflict) toast.error(result.error);
}

async function deleteDishImage(dish, imageId) {
  const result = await owner.deleteImage(imageId, { dishId: dish.id });
  if (result.ok) toast.success('Foto eliminada.');
  else if (!result.conflict) toast.error(result.error);
}

const savedDish = (id) => owner.menu.categories.flatMap((c) => c.dishes).find((d) => d.id === id);
</script>

<template>
  <section class="menu">
    <h1 class="menu__title">Carta y Precios</h1>

    <div
      v-if="owner.status === OWNER_STATUS.LOADING || owner.status === OWNER_STATUS.IDLE"
      role="status"
      aria-busy="true"
    >
      <span class="sr-only">Cargando tu carta…</span>
      <AppSkeleton height="200px" />
    </div>
    <ErrorState
      v-else-if="owner.status === OWNER_STATUS.ERROR"
      :message="owner.error"
      @retry="ensureLoaded({ force: true })"
    />

    <template v-else-if="owner.huarique">
      <OwnerNotices />

      <form class="menu__form" novalidate @submit.prevent="saveMenu">
        <AppCard v-for="(category, ci) in draft" :key="category.key" as="section" class="category">
          <div class="category__header">
            <AppInput
              v-model="category.name"
              label="Nombre de la categoría"
              :error="errors[`category-${ci}`]"
            />
            <AppButton variant="danger" @click="draft.splice(ci, 1)">
              <AppIcon name="x" :size="18" /> Quitar categoría
            </AppButton>
          </div>

          <ul class="dishes">
            <li v-for="(dish, di) in category.dishes" :key="dish.key" class="dish">
              <div class="dish__fields">
                <AppInput
                  v-model="dish.name"
                  label="Platillo"
                  :error="errors[`dish-${ci}-${di}-name`]"
                />
                <AppInput
                  v-model="dish.price"
                  label="Precio (S/)"
                  inputmode="decimal"
                  :error="errors[`dish-${ci}-${di}-price`]"
                />
                <AppInput v-model="dish.description" label="Descripción" optional />
              </div>
              <AppButton variant="secondary" @click="category.dishes.splice(di, 1)">
                <AppIcon name="x" :size="18" /> Quitar platillo
              </AppButton>

              <!-- Quick edits on dishes already saved: own PATCH calls, no need to save the whole menu. -->
              <div v-if="dish.id && savedDish(dish.id)" class="dish__quick">
                <StatusBadge :status="savedDish(dish.id).available ? 'available' : 'unavailable'" />
                <AppButton
                  variant="secondary"
                  :disabled="owner.saving"
                  @click="toggleAvailability(savedDish(dish.id))"
                >
                  {{
                    savedDish(dish.id).available
                      ? 'Marcar no disponible hoy'
                      : 'Marcar disponible hoy'
                  }}
                </AppButton>
                <div class="dish__price">
                  <AppInput
                    v-model="priceEdits[dish.id]"
                    :label="`Cambiar precio de ${savedDish(dish.id).name} (hoy ${formatSoles(savedDish(dish.id).price)})`"
                    inputmode="decimal"
                    :error="priceErrors[dish.id]"
                  />
                  <AppButton
                    variant="secondary"
                    :disabled="owner.saving || !priceEdits[dish.id]"
                    @click="savePrice(savedDish(dish.id))"
                  >
                    Actualizar precio
                  </AppButton>
                </div>
                <details class="dish__photos">
                  <summary>Fotos del plato ({{ savedDish(dish.id).images.length }})</summary>
                  <ImageManager
                    :images="savedDish(dish.id).images"
                    :max="MAX_DISH_IMAGES"
                    :busy="owner.saving"
                    label="Agregar foto del plato"
                    @upload="uploadDishImage(savedDish(dish.id), $event)"
                    @delete="deleteDishImage(savedDish(dish.id), $event)"
                  />
                </details>
              </div>
            </li>
          </ul>

          <AppButton variant="secondary" @click="category.dishes.push(newDish())">
            + Agregar platillo
          </AppButton>
        </AppCard>

        <p v-if="draft.length === 0" class="menu__empty">
          Tu carta está vacía. Agrega una categoría para empezar.
        </p>

        <div class="menu__actions">
          <AppButton variant="secondary" @click="draft.push(newCategory())"
            >+ Agregar categoría</AppButton
          >
          <AppButton type="submit" :loading="owner.saving">Guardar carta</AppButton>
        </div>
      </form>
    </template>
  </section>
</template>

<style scoped>
.menu {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.menu__title {
  font-size: var(--text-2xl);
}

.menu__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.category {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.category__header {
  display: grid;
  gap: var(--space-3);
  align-items: end;
}

@media (min-width: 640px) {
  .category__header {
    grid-template-columns: 1fr auto;
  }
}

.dishes {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.dish {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-surface-soft);
  border-radius: var(--radius-md);
}

.dish__fields {
  display: grid;
  gap: var(--space-3);
  width: 100%;
}

@media (min-width: 640px) {
  .dish__fields {
    grid-template-columns: 2fr 1fr 2fr;
  }
}

.dish__quick {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  width: 100%;
  padding-top: var(--space-3);
  border-top: 1px dashed var(--color-border-strong);
}

.dish__price {
  display: grid;
  gap: var(--space-2);
  width: 100%;
  max-width: 420px;
}

.dish__photos {
  width: 100%;
}

.dish__photos summary {
  min-height: var(--touch-target);
  font-weight: 600;
  cursor: pointer;
}

.menu__empty {
  color: var(--color-text-muted);
}

.menu__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-3);
}
</style>
