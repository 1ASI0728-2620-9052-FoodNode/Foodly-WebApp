<script setup>
import { CUISINE_TYPES } from '../domain/huarique.js';
import { LIMITS } from '../domain/huariqueForm.js';
import TagsInput from './TagsInput.vue';
import AppInput from '../../../shared/ui/AppInput.vue';
import AppSelect from '../../../shared/ui/AppSelect.vue';

/** Name, specialty (CuisineType) and tags. `form` is the reactive huarique form. */
defineProps({
  form: { type: Object, required: true },
  errors: { type: Object, default: () => ({}) },
});

const cuisineOptions = [
  { value: '', label: 'Elige una especialidad' },
  ...Object.entries(CUISINE_TYPES).map(([value, label]) => ({ value, label })),
];
</script>

<template>
  <div class="fields">
    <AppInput
      v-model="form.name"
      label="Nombre oficial del huarique"
      :maxlength="LIMITS.NAME"
      autocomplete="organization"
      :error="errors.name"
    />
    <AppSelect
      v-model="form.cuisineType"
      label="Especialidad"
      :options="cuisineOptions"
      :error="errors.cuisineType"
    />
    <TagsInput v-model="form.tags" :error="errors.tags" />
  </div>
</template>

<style scoped>
.fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
