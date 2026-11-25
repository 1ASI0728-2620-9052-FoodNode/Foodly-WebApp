# Recorrido E2E contra el backend real

Fecha: 2026-11-25. Rama `feature/web-hardening`. Cubre UF-W1, UF-W2, UF-W5 (onboarding) y UF-W6 (gestión).

## Entorno verificado

Infraestructura de `foodly-infra` ya levantada en el equipo (no se reinició nada):

| Pieza                                             | Estado                            | Puerto                        |
| ------------------------------------------------- | --------------------------------- | ----------------------------- |
| Kong (gateway)                                    | healthy                           | 8000                          |
| Business, IAM, Radar, Messaging                   | respondiendo (401 sin token)      | 8080, 8081, 8082, 8083        |
| MongoDB (rs0), RabbitMQ, PostgreSQL, Redis, MySQL | healthy                           | 27017, 5672, 5433, 6379, 3307 |
| Reservation (8084), Community (8086)              | **no existen**: Kong responde 502 | —                             |

Por eso Reservación y Community corren con los mocks de localStorage (`VITE_MOCK_RESERVATION` / `VITE_MOCK_COMMUNITY`).

Cómo se corrió:

- **Contratos por API** (paso a paso, abajo): script de Node contra `http://localhost:8000`.
- **Interfaz real**: Playwright + Chromium contra el dev server de Vite (proxy a Kong): `npm run e2e`.
  Los tests se omiten solos si el gateway no responde.
- Datos de prueba: usuarios `e2e-*@foodly.test` y huariques `E2E …` / `La Cevichería de Pepe …` en las bases locales.

## UF-W1 · Registro e inicio de sesión

| #   | Paso                                   | Resultado esperado                          | Resultado real                                                                                                                                         |
| --- | -------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `POST /iam/auth/register` (dueño)      | 201 con `token`, `role`                     | ✅ 201 (≈450 ms). JWT con `iss=foodly-iam`, `aud=[iam, business, radar, messaging, reservation, community]`, `role=HUARIQUE_OWNER`, `sub`, `exp` a 1 h |
| 2   | Registrar el mismo correo              | 409                                         | ✅ 409 → el formulario muestra «El correo electrónico o el nombre de usuario ya están registrados.»                                                    |
| 3   | Login con contraseña incorrecta        | 401                                         | ✅ 401 → «Correo o contraseña incorrectos.» (no cierra sesión)                                                                                         |
| 4   | `POST /iam/auth/login`                 | 200                                         | ✅ 200 (≈400 ms)                                                                                                                                       |
| 5   | `GET /iam/users/me`                    | 200 con perfil                              | ✅ 200                                                                                                                                                 |
| 6   | UI: registrar dueño → redirección      | `/owner/onboarding` (aún no tiene huarique) | ✅ (`GET /business-api/huariques/me` → 404 → onboarding)                                                                                               |
| 7   | UI: registrar explorador → redirección | `/radar`                                    | ✅                                                                                                                                                     |

**El bloqueo 3.1 del `CLAUDE.md` raíz ya no aplica**: el token de IAM trae `iss`/`aud` y Business lo acepta
(`/business-api/huariques/me` responde 404/200, no 401). El texto del `CLAUDE.md` raíz está desactualizado en ese punto.

## UF-W5 · Onboarding (W6)

| #   | Paso                                                                                  | Resultado                                                                          |
| --- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Pasos 1 y 2 del wizard (identidad, precios, ubicación con «Usar mi ubicación actual») | ✅ validaciones por paso, pin en el mapa                                           |
| 2   | Paso 3 (horarios y 2 platillos estrella)                                              | ✅                                                                                 |
| 3   | «Publicar Huarique y Activar Radar» → `POST /business-api/huariques`                  | ✅ 201, `openStatus=CLOSED`, `version=0` (≈350 ms)                                 |
| 4   | `PUT /business-api/huariques/{id}/menu` sin `version`                                 | ✅ 200, `version=0` del menú                                                       |
| 5   | `PATCH /open-status` `{OPEN, version: 0}`                                             | ✅ 200, `openStatus=OPEN`, `version=1`                                             |
| 6   | `PATCH /open-status` con la versión vieja (0)                                         | ✅ 409 (control de versión)                                                        |
| 7   | `POST /business-api/huariques` por segunda vez                                        | ✅ 409 → la UI muestra «Ya tienes un huarique registrado» y va al dashboard        |
| 8   | Redirección                                                                           | ✅ `/owner/dashboard` con «Abierto Ahora» y «Visible en el Radar en unos segundos» |

## UF-W2 · Radar (W2)

| #   | Paso                                                                                                     | Resultado                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Token de dueño en `POST /radar/search`                                                                   | ✅ 403 (solo exploradores)                                                                                                                                                                                                                            |
| 2   | Explorador: «Compartir Mi Ubicación» (Miraflores) → `POST /radar/search {latitude, longitude, kRing: 2}` | ✅ 200 en ≈45–150 ms                                                                                                                                                                                                                                  |
| 3   | El huarique recién publicado aparece                                                                     | ✅ **tras ≈1 s** (llega por RabbitMQ). El test reintenta por si la primera búsqueda se adelanta al evento                                                                                                                                             |
| 4   | Enriquecimiento `GET /business-api/huariques/{id}` en paralelo                                           | ✅ nombre, cocina, precio `S/ 20 – S/ 45`, «Abierto Ahora», distancia                                                                                                                                                                                 |
| 5   | RNF-01 (≤ 2 s)                                                                                           | ✅ el test lee el tiempo que muestra la pantalla en modo dev y exige ≤ 2000 ms: 24 ms en la última corrida (Radar + enriquecimiento con Business; la última búsqueda reutiliza el catálogo en caché, la primera tarda más pero muy por debajo de 2 s) |
| 6   | Detalle: `GET …/{id}` y `GET …/{id}/menu`                                                                | ✅ carta con los 2 platillos                                                                                                                                                                                                                          |
| 7   | Reservation / Community vía Kong                                                                         | 502 (servicios inexistentes) → mocks                                                                                                                                                                                                                  |

## Lía (Messaging)

`node scripts/check-lia.mjs` contra el gateway real:

- `POST /messaging/chat` → **202** `{conversationId, messageId, status: PROCESSING}` en 40 ms.
- STOMP `CONNECT` con `Authorization: Bearer <jwt>` → conectado.
- Respuesta de Lía por `/topic/conversations/{id}` en **≈1,3 s**, `intentType=RECOMMENDATION_REQUEST`,
  `huariqueId=null`, texto «1. Nombre (a 0 m)…». Por eso las tarjetas sugeridas se obtienen emparejando esos nombres con
  una búsqueda de Radar (el mensaje no trae ids).

## Fallas encontradas y corregidas

| Hallazgo                                                                        | Causa                                                                                                                       | Corrección                                                                                                              |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Recargar o abrir directo `/radar` en desarrollo mostraba el JSON `401` de Radar | `/radar` es ruta de la SPA **y** prefijo de API: el proxy de Vite la mandaba a Kong                                         | `bypass` en el proxy para navegaciones `text/html`; en nginx, `location = /radar` exacto. Test `e2e/deep-links.spec.js` |
| nginx respondía `301 /radar → /radar/`                                          | el `location /radar/` de la API                                                                                             | `location = /radar` que sirve `index.html`                                                                              |
| `docker build` fallaba en `npm ci`                                              | el lockfile generado en Windows no traía `@emnapi/core` ni `@emnapi/runtime` (dependencias opcionales de rolldown en Linux) | se fijan como devDependencies                                                                                           |
| Aviso de Vue: `AppInput` recibía un número                                      | `modelValue` solo admitía `String`                                                                                          | `[String, Number]`                                                                                                      |
| El voucher mostraba `APPROVED`                                                  | enum crudo                                                                                                                  | etiqueta en español (`STATUS_LABELS`)                                                                                   |
| Lighthouse SEO 91                                                               | sin `robots.txt` (el SPA devolvía HTML)                                                                                     | `public/robots.txt`                                                                                                     |
| Lighthouse prácticas 96 en `/radar`                                             | el build sin mocks llamaba a `/community/favorites/me` → 502                                                                | se mide con `VITE_MOCK_*` (en el build real, Community aún no existe)                                                   |

## Responsive, teclado y contraste

`e2e/responsive-a11y.spec.js` (axe-core, WCAG 2.0/2.1 A y AA incluido contraste) en **360, 768 y 1280 px**:

- `/login` (pestañas Iniciar sesión y Registrarse) y `/radar`: sin violaciones, sin scroll horizontal, áreas táctiles ≥ 44 px.
- Barra superior desde 768 px y barra inferior por debajo.
- Teclado: el enlace «Saltar al contenido» recibe el primer foco; las pestañas se mueven con flechas; cada parada del
  formulario muestra un indicador de foco.

Puntajes de Lighthouse: [`LIGHTHOUSE.md`](LIGHTHOUSE.md).

## Lo que no se verificó

- Reservation y Community **reales**: no existen; los contratos 5.4.2/5.5.2 están implementados contra el texto del enunciado
  y probados con mocks y clientes HTTP falsos.
- Las respuestas de Lía dependen de n8n: en esta corrida respondió; si n8n cae, el chat muestra el aviso de reserva manual (RF-15).
- Pruebas en navegadores distintos de Chromium y en dispositivos físicos.
