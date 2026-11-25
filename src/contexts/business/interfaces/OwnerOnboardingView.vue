<script setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { PUBLISH_STAGES, useOnboardingStore } from '../application/useOnboardingStore.js';
import { OWNER_STATUS, useOwnerHuariqueStore } from '../application/useOwnerHuariqueStore.js';
import { ONBOARDING_STEPS, STAR_DISHES } from '../domain/huariqueForm.js';
import IdentityFields from './IdentityFields.vue';
import PricingLocationFields from './PricingLocationFields.vue';
import OpeningHoursEditor from './OpeningHoursEditor.vue';
import AppButton from '../../../shared/ui/AppButton.vue';
import AppCard from '../../../shared/ui/AppCard.vue';
import AppIcon from '../../../shared/ui/AppIcon.vue';
import AppInput from '../../../shared/ui/AppInput.vue';
import { useToast } from '../../../shared/ui/useToast.js';

const router = useRouter();
const toast = useToast();
const onboarding = useOnboardingStore();
const owner = useOwnerHuariqueStore();
const { form, step, publishing, error, failedStage, currentErrors, progressPercent } =
  storeToRefs(onboarding);

const isLastStep = computed(() => step.value === ONBOARDING_STEPS.length);
const stepTitle = computed(() => ONBOARDING_STEPS[step.value - 1].title);
const dishErrors = computed(() => currentErrors.value.dishList ?? []);

async function publish() {
  const result = await onboarding.publish();
  if (result.ok) {
    toast.success('¡Tu huarique está publicado! Será visible en el Radar en unos segundos.');
    await router.replace({ name: 'owner-dashboard' });
  } else if (result.alreadyRegistered) {
    toast.info('Ya tienes un huarique registrado.');
    await router.replace({ name: 'owner-dashboard' });
  }
}

onMounted(async () => {
  // An owner who already has a huarique has nothing to register.
  await owner.load();
  if (owner.status === OWNER_STATUS.READY && !onboarding.publishing) {
    await router.replace({ name: 'owner-dashboard' });
    return;
  }
  if (onboarding.restoreDraft())
    toast.info('Recuperamos tu borrador. Puedes continuar donde lo dejaste.');
});
</script>

<template>
  <section class="onboarding">
    <header>
      <h1 class="onboarding__title">Registra tu huarique</h1>
      <p class="onboarding__lead">
        Tres pasos y tu huarique aparece en el Radar de los exploradores.
      </p>
    </header>

    <div
      class="progress"
      role="progressbar"
      aria-label="Progreso del registro"
      :aria-valuenow="progressPercent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuetext="`Paso ${step} de ${ONBOARDING_STEPS.length}: ${stepTitle}`"
    >
      <div
        class="progress__bar"
        :style="{ width: `${progressPercent + 100 / ONBOARDING_STEPS.length}%` }"
      />
    </div>
    <ol class="steps" aria-label="Pasos">
      <li
        v-for="item in ONBOARDING_STEPS"
        :key="item.id"
        class="steps__item"
        :class="{ 'steps__item--active': item.id === step, 'steps__item--done': item.id < step }"
        :aria-current="item.id === step ? 'step' : undefined"
      >
        <span class="steps__number">
          <AppIcon v-if="item.id < step" name="check" :size="14" />
          <template v-else>{{ item.id }}</template>
        </span>
        {{ item.title }}
      </li>
    </ol>

    <AppCard>
      <form
        class="onboarding__form"
        novalidate
        @submit.prevent="isLastStep ? publish() : onboarding.next()"
      >
        <h2 class="onboarding__step-title">
          Paso {{ step }}:
          {{
            step === 1
              ? 'Identidad del Huarique'
              : step === 2
                ? 'Nivel de Precios y Ubicación Geográfica'
                : 'Horarios y Platillos del Día'
          }}
        </h2>

        <IdentityFields v-if="step === 1" :form="form" :errors="currentErrors" />

        <PricingLocationFields v-else-if="step === 2" :form="form" :errors="currentErrors" />

        <template v-else>
          <OpeningHoursEditor v-model="form.openingHours" :error="currentErrors.openingHours" />
          <fieldset class="dishes">
            <legend class="dishes__legend">{{ STAR_DISHES }} platillos estrella</legend>
            <div v-for="(dish, index) in form.dishes" :key="index" class="dishes__row">
              <AppInput
                v-model="dish.name"
                :label="`Platillo ${index + 1}`"
                :error="dishErrors[index]?.name"
              />
              <AppInput
                v-model="dish.price"
                :label="`Precio del platillo ${index + 1} (S/)`"
                inputmode="decimal"
                :error="dishErrors[index]?.price"
              />
            </div>
            <p v-if="currentErrors.dishes" class="dishes__error" role="alert">
              {{ currentErrors.dishes }}
            </p>
          </fieldset>
        </template>

        <div v-if="error" class="onboarding__alert" role="alert">
          <AppIcon name="alert" :size="20" />
          <p>
            {{ error }}
            <template v-if="failedStage && failedStage !== PUBLISH_STAGES.REGISTER">
              Tu avance está guardado: vuelve a intentarlo y continuaremos desde donde quedó.
            </template>
          </p>
        </div>

        <div class="onboarding__actions">
          <AppButton
            v-if="step > 1"
            variant="secondary"
            :disabled="publishing"
            @click="onboarding.back()"
          >
            <AppIcon name="arrowLeft" :size="18" /> Atrás
          </AppButton>
          <AppButton v-if="!isLastStep" type="submit">Siguiente</AppButton>
          <AppButton v-else type="submit" variant="success" :loading="publishing">
            Publicar Huarique y Activar Radar
          </AppButton>
        </div>
      </form>
    </AppCard>
  </section>
</template>

<style scoped>
.onboarding {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 720px;
  margin: 0 auto;
}

.onboarding__title {
  font-size: var(--text-2xl);
}

.onboarding__lead {
  color: var(--color-text-muted);
}

.progress {
  height: 10px;
  background: var(--color-surface-soft);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.progress__bar {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s;
}

.steps {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.steps__item {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.steps__item--active {
  color: var(--color-primary);
}

.steps__number {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--color-surface-soft);
  border: 2px solid currentcolor;
  border-radius: 50%;
}

.steps__item--done .steps__number {
  background: var(--color-success);
  border-color: var(--color-success);
  color: var(--color-white);
}

.onboarding__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.onboarding__step-title {
  font-size: var(--text-xl);
}

.dishes {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.dishes__legend {
  margin-bottom: var(--space-2);
  padding: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-brown);
}

.dishes__row {
  display: grid;
  gap: var(--space-3);
}

@media (min-width: 480px) {
  .dishes__row {
    grid-template-columns: 2fr 1fr;
  }
}

.dishes__error {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-error);
}

.onboarding__alert {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-error-soft);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-error);
}

.onboarding__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-3);
}
</style>
