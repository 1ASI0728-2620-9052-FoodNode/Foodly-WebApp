<script setup>
import { ref, useId } from 'vue';
import { LIMITS } from '../domain/huariqueForm.js';
import AppIcon from '../../../shared/ui/AppIcon.vue';

const props = defineProps({
  modelValue: { type: Array, required: true },
  label: { type: String, default: 'Etiquetas' },
  error: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);

const id = useId();
const draft = ref('');

function add() {
  const tag = draft.value.trim().replace(/,$/, '').trim();
  draft.value = '';
  if (!tag) return;
  // Duplicates are rejected by Business; skipping them here keeps the list clean.
  if (props.modelValue.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
  emit('update:modelValue', [...props.modelValue, tag]);
}

function remove(tag) {
  emit(
    'update:modelValue',
    props.modelValue.filter((t) => t !== tag),
  );
}

function onKeydown(event) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    add();
  } else if (event.key === 'Backspace' && !draft.value && props.modelValue.length) {
    remove(props.modelValue.at(-1));
  }
}
</script>

<template>
  <div class="tags" :class="{ 'tags--invalid': error }">
    <label class="tags__label" :for="id"
      >{{ label }} <span class="tags__hint">(opcional)</span></label
    >
    <ul v-if="modelValue.length" class="tags__list">
      <li v-for="tag in modelValue" :key="tag" class="tags__chip">
        {{ tag }}
        <button
          type="button"
          class="tags__remove"
          :aria-label="`Quitar etiqueta ${tag}`"
          @click="remove(tag)"
        >
          <AppIcon name="x" :size="14" />
        </button>
      </li>
    </ul>
    <input
      :id="id"
      v-model="draft"
      class="tags__input"
      type="text"
      :maxlength="LIMITS.TAG"
      placeholder="Ej: ceviche, pescado fresco — Enter para agregar"
      :aria-invalid="error ? 'true' : undefined"
      @keydown="onKeydown"
      @blur="add"
    />
    <p v-if="error" class="tags__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.tags {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.tags__label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-brown);
}

.tags__hint {
  font-weight: 400;
  color: var(--color-text-muted);
}

.tags__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.tags__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
  background: var(--color-surface-soft);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  font-size: var(--text-sm);
  font-weight: 600;
}

.tags__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-target);
  height: 32px;
  background: none;
  border: 0;
  border-radius: 50%;
  color: var(--color-text-muted);
  cursor: pointer;
}

.tags__input {
  min-height: var(--touch-target);
  padding: var(--space-2) var(--space-4);
  background: var(--color-white);
  border: 2px solid var(--color-border-strong);
  border-radius: var(--radius-md);
}

.tags__input:focus-visible {
  outline: none;
  border-color: var(--color-focus);
  box-shadow: var(--focus-ring);
}

.tags--invalid .tags__input {
  border-color: var(--color-error);
}

.tags__error {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-error);
}
</style>
