import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@fontsource-variable/plus-jakarta-sans';
import './shared/ui/tokens.css';
import './shared/ui/base.css';
import App from './app/App.vue';
import { createAppRouter } from './app/router.js';
import { wireSession } from './app/bootstrap.js';
import { useAuthStore } from './contexts/iam/application/useAuthStore.js';

async function start() {
  const app = createApp(App);
  app.use(createPinia());

  const router = createAppRouter();
  wireSession(router);

  // Rebuild the session from sessionStorage BEFORE the first navigation so guards see it.
  await useAuthStore().restore();

  app.use(router);
  await router.isReady();
  app.mount('#app');
}

start();
