<script setup>
import { ref, useId } from 'vue';
import { ALLOWED_IMAGE_TYPES, validateImageFile } from '../domain/images.js';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';

/** Thumbnails with upload / replace / delete. The parent decides what each action does. */
defineProps({
  images: { type: Array, required: true },
  max: { type: Number, required: true },
  busy: { type: Boolean, default: false },
  label: { type: String, default: 'Agregar foto' },
});

const emit = defineEmits(['upload', 'delete']);

const id = useId();
const error = ref('');
const replaceTarget = ref(null);
const fileInput = ref(null);

function pick(replaceId = null) {
  replaceTarget.value = replaceId;
  fileInput.value?.click();
}

function onChange(event) {
  const file = event.target.files?.[0];
  event.target.value = ''; // allows choosing the same file again
  if (!file) return;
  error.value = validateImageFile(file);
  if (error.value) return;
  emit('upload', { file, replaceId: replaceTarget.value });
}
</script>

<template>
  <div class="images">
    <ul v-if="images.length" class="images__grid">
      <li v-for="(image, index) in images" :key="image.id" class="images__item">
        <img :src="image.url" :alt="`Foto ${index + 1}`" loading="lazy" />
        <div class="images__actions">
          <button
            type="button"
            class="images__button"
            :disabled="busy"
            :aria-label="`Reemplazar foto ${index + 1}`"
            @click="pick(image.id)"
          >
            <AppIcon name="refresh" :size="18" />
          </button>
          <button
            type="button"
            class="images__button images__button--danger"
            :disabled="busy"
            :aria-label="`Eliminar foto ${index + 1}`"
            @click="emit('delete', image.id)"
          >
            <AppIcon name="x" :size="18" />
          </button>
        </div>
      </li>
    </ul>
    <p v-else class="images__empty">Aún no hay fotos.</p>

    <input
      :id="id"
      ref="fileInput"
      class="sr-only"
      type="file"
      :accept="ALLOWED_IMAGE_TYPES.join(',')"
      tabindex="-1"
      @change="onChange"
    />
    <div class="images__footer">
      <AppButton
        variant="secondary"
        :disabled="busy || images.length >= max"
        :loading="busy"
        @click="pick()"
      >
        <AppIcon name="image" :size="18" /> {{ label }}
      </AppButton>
      <p class="images__count">{{ images.length }} de {{ max }} · JPG, PNG o WebP, hasta 5 MB</p>
    </div>
    <p v-if="error" class="images__error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.images {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.images__grid {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.images__item {
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface-soft);
}

.images__item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.images__actions {
  position: absolute;
  right: var(--space-1);
  bottom: var(--space-1);
  display: flex;
  gap: var(--space-1);
}

.images__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-target);
  height: var(--touch-target);
  background: var(--color-white);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-brown);
  cursor: pointer;
}

.images__button--danger {
  color: var(--color-error);
}

.images__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.images__empty,
.images__count {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.images__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.images__error {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-error);
}
</style>
