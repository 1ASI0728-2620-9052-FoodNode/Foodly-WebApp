<script setup>
import { computed } from 'vue';
import { CUISINE_TYPES, PRICE_LEVELS } from '../domain/huarique.js';
import { EMPTY_FILTERS, hasActiveFilters } from '../domain/huariqueFilters.js';
import { DISTRICTS } from '../../../shared/geo/districts.js';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppInput from '../../../shared/ui/AppInput.vue';
import AppSelect from '../../../shared/ui/AppSelect.vue';

const props = defineProps({
  modelValue: { type: Object, required: true },
  showPrice: { type: Boolean, default: true },
  showDistrict: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);

const cuisineOptions = [
  { value: '', label: 'Todas las categorías' },
  ...Object.entries(CUISINE_TYPES).map(([value, label]) => ({ value, label })),
];
const priceOptions = [
  { value: '', label: 'Cualquier precio' },
  ...PRICE_LEVELS.map((level) => ({ value: String(level.value), label: level.label })),
];
const districtOptions = [
  { value: '', label: 'Todos los distritos' },
  ...DISTRICTS.map((district) => ({ value: district.id, label: district.name })),
];

const active = computed(() => hasActiveFilters(props.modelValue));

const update = (patch) => emit('update:modelValue', { ...props.modelValue, ...patch });
</script>

<template>
  <form class="filters" role="search" aria-label="Filtros de huariques" @submit.prevent>
    <AppInput
      :model-value="modelValue.text"
      label="Buscar por nombre o etiqueta"
      type="search"
      autocomplete="off"
      @update:model-value="update({ text: $event })"
    />
    <div class="filters__row">
      <AppSelect
        :model-value="modelValue.cuisine"
        label="Categoría"
        :options="cuisineOptions"
        @update:model-value="update({ cuisine: $event })"
      />
      <AppSelect
        v-if="showPrice"
        :model-value="String(modelValue.priceLevel)"
        label="Nivel de precio"
        :options="priceOptions"
        @update:model-value="update({ priceLevel: $event })"
      />
      <AppSelect
        v-if="showDistrict"
        :model-value="modelValue.district"
        label="Distrito"
        :options="districtOptions"
        @update:model-value="update({ district: $event })"
      />
    </div>
    <div class="filters__footer">
      <label class="filters__check">
        <input
          type="checkbox"
          :checked="modelValue.openNow"
          @change="update({ openNow: $event.target.checked })"
        />
        Abierto Ahora
      </label>
      <AppButton
        v-if="active"
        variant="secondary"
        @click="emit('update:modelValue', { ...EMPTY_FILTERS })"
      >
        Limpiar filtros
      </AppButton>
    </div>
  </form>
</template>

<style scoped>
.filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.filters__row {
  display: grid;
  gap: var(--space-3);
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.filters__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.filters__check {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch-target);
  font-weight: 600;
  cursor: pointer;
}

.filters__check input {
  width: 22px;
  height: 22px;
  accent-color: var(--color-primary);
}
</style>
