<script setup>
import { OWNER_STATUS } from '../application/useOwnerHuariqueStore.js';
import { useOwnerPage } from '../application/useOwnerPage.js';
import { MAX_GALLERY_IMAGES } from '../domain/images.js';
import ImageManager from './ImageManager.vue';
import OwnerNotices from './OwnerNotices.vue';
import AppCard from '../../../shared/ui/AppCard.vue';
import AppSkeleton from '../../../shared/ui/AppSkeleton.vue';
import ErrorState from '../../../shared/ui/ErrorState.vue';
import { useToast } from '../../../shared/ui/useToast.js';

const { owner, ensureLoaded } = useOwnerPage();
const toast = useToast();

async function upload({ file, replaceId }) {
  const result = await owner.uploadImage(file, { replaceId });
  if (result.ok) toast.success(replaceId ? 'Foto reemplazada.' : 'Foto agregada.');
  else if (!result.conflict) toast.error(result.error);
}

async function remove(imageId) {
  const result = await owner.deleteImage(imageId);
  if (result.ok) toast.success('Foto eliminada.');
  else if (!result.conflict) toast.error(result.error);
}
</script>

<template>
  <section class="gallery">
    <h1 class="gallery__title">Fotos y Galería</h1>

    <div
      v-if="owner.status === OWNER_STATUS.LOADING || owner.status === OWNER_STATUS.IDLE"
      role="status"
      aria-busy="true"
    >
      <span class="sr-only">Cargando tu galería…</span>
      <AppSkeleton height="200px" />
    </div>
    <ErrorState
      v-else-if="owner.status === OWNER_STATUS.ERROR"
      :message="owner.error"
      @retry="ensureLoaded({ force: true })"
    />
    <template v-else-if="owner.huarique">
      <OwnerNotices />
      <AppCard>
        <p class="gallery__lead">
          Las fotos de tu huarique se muestran en el Radar y en su ficha. Hasta
          {{ MAX_GALLERY_IMAGES }} fotos.
        </p>
        <ImageManager
          :images="owner.huarique.images"
          :max="MAX_GALLERY_IMAGES"
          :busy="owner.saving"
          @upload="upload"
          @delete="remove"
        />
      </AppCard>
    </template>
  </section>
</template>

<style scoped>
.gallery {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.gallery__title {
  font-size: var(--text-2xl);
}

.gallery__lead {
  margin-bottom: var(--space-4);
  color: var(--color-text-muted);
}
</style>
