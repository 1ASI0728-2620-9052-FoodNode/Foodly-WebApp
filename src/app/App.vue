<script setup>
import AppToast from '../shared/ui/AppToast.vue';
</script>

<template>
  <a class="skip-link" href="#main">Saltar al contenido</a>
  <RouterView />
  <AppToast />
</template>
