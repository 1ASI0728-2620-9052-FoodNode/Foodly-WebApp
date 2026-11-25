# Foodly WebApp

Aplicación web de Foodly (curso 1ASI0728, UPC). Cliente para dos perfiles:

- **Explorador Gastronómico** (`GASTRONOMIC_EXPLORER`): Radar H3, Favoritos, Mensajes (Lía), Perfil.
- **Dueño de Huarique** (`HUARIQUE_OWNER`, "Foodly Admin"): Dashboard, Reservas, Mi Menú, Galería, Perfil.

Estado actual (`feature/web-foundation`): base del proyecto, design system, layouts, cliente HTTP, y la
pantalla **W1 (Registro / Inicio de sesión, UF-W1)** con guards por rol y páginas 403/404. El resto de
pantallas son marcadores "Próximamente" que cada fase posterior reemplaza.

## Stack

Vue 3 + Vite · JavaScript (sin TypeScript) · Vue Router · Pinia · ESLint (`eslint-plugin-vue` recommended) +
Prettier · Vitest + `@vue/test-utils` · Leaflet + OpenStreetMap + `h3-js` (mapas, fases siguientes). Sin
librerías de UI: componentes propios con variables CSS.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
npm run dev                  # http://localhost:5173
```

Requisitos: Node 20+ (probado con 24).

| Script                              | Qué hace                                        |
| ----------------------------------- | ----------------------------------------------- |
| `npm run dev`                       | Servidor de desarrollo con proxy al gateway     |
| `npm run build` / `npm run preview` | Build de producción / servirlo localmente       |
| `npm run lint` / `lint:fix`         | ESLint (`.js` y `.vue`)                         |
| `npm run format` / `format:check`   | Prettier                                        |
| `npm run test`                      | Vitest (una pasada); `test:watch` para observar |

Antes de abrir un PR deben pasar `npm run lint`, `npm run test` y `npm run build`.

## Variables de entorno

Copiar `.env.example` a `.env.local` (ignorado por git). Todo `VITE_*` queda **público** en el bundle:
nunca poner secretos.

| Variable                | Uso                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `VITE_API_GATEWAY_URL`  | URL de Kong (`http://localhost:8000`). Destino del proxy en desarrollo; base URL en build. |
| `VITE_MOCK_RESERVATION` | `true` mientras Reservation no tenga API.                                                  |
| `VITE_MOCK_COMMUNITY`   | `true` mientras Community no tenga API.                                                    |

## Conexión con el backend

Todo el tráfico va al API Gateway Kong. En desarrollo, Vite hace de proxy de `/iam`, `/business-api`,
`/radar`, `/messaging` (con WebSocket), `/reservation-api` y `/community` hacia `VITE_API_GATEWAY_URL`, así
el navegador solo habla con `localhost:5173` y **no hay CORS**. En el build de producción el cliente usa
`VITE_API_GATEWAY_URL` directamente, por lo que Kong (o el hosting) debe resolver CORS o servir la app bajo
el mismo origen.

Para probar contra el backend real: levantar la infraestructura con `foodly-infra\start-all.ps1` (Kong en
`:8000`, IAM `:8081`, Business `:8080`).

## Arquitectura

Organización por bounded context, igual que `AppMobile-FoodNode`:

```
src/
  app/                  router, guards, layouts, vistas globales (login, 403, 404), bootstrap, App.vue
  shared/
    config/             lectura de variables de entorno
    http/               cliente fetch (base URL, Bearer, JSON, timeout, errores en español)
    ui/                 tokens.css, base.css y componentes base (AppButton, AppInput, StatusBadge, ...)
    utils/              utilidades puras (jwt)
  contexts/<iam|radar|business|community|reservation|messaging>/
    domain/             modelos y reglas simples (sin Vue, sin HTTP)
    infrastructure/     XxxService.js (TODAS las llamadas HTTP) y MockXxxService.js
    application/        stores Pinia y composables useXxx
    interfaces/         vistas y componentes .vue
```

Los componentes **nunca** llaman al backend: pasan por un store o composable, que usa un `XxxService`.
`app/` puede orquestar varios contextos (p. ej. `postLoginRoute.js` usa IAM y Business); los contextos
no importan de `app/`.

## Design system

`src/shared/ui/tokens.css` define la paleta del informe (6.1): `--color-primary #964100`,
`--color-brown #492906`, `--color-bg #FFF8F5`, `--color-surface-soft #FFF1E8`, `--color-success #5A7D00`,
`--color-success-soft #C8F06E`, `--color-white #FFFFFF`, más rojo de error y naranja brillante de pendiente.
Tipografía Plus Jakarta Sans (`@fontsource-variable`). Componentes base: `AppButton`
(primary/secondary/danger/success), `AppCard`, `AppInput`, `AppSelect`, `StatusBadge`, `EmptyState`,
`LoadingState`, `ErrorState`, `AppToast` (+ `useToast`) y `AppIcon`.

Accesibilidad: foco visible global, `aria-label` en controles de solo ícono, áreas táctiles de al menos
44 px, estados siempre con texto + ícono (nunca solo color) y colores de texto con contraste AA.
Layout responsive: barra superior desde 768 px, barra inferior por debajo.

## W1 · Registro / Inicio de sesión

Endpoints (verificados en `Foodly-IAM-Service`):

| Acción        | Endpoint                         | Respuesta                                             |
| ------------- | -------------------------------- | ----------------------------------------------------- |
| Registro      | `POST /iam/auth/register` → 201  | `{ token, tokenType, expiresAt, userId, name, role }` |
| Login         | `POST /iam/auth/login` → 200     | igual que registro                                    |
| Perfil propio | `GET /iam/users/me`              | `{ id, name, email, username, phone, role }`          |
| Mi huarique   | `GET /business-api/huariques/me` | huarique, o `404` si el dueño aún no registró uno     |

Validaciones del formulario (espejo de `RegisterUserResource` y los value objects de IAM):

| Campo      | Regla                                                                                   |
| ---------- | --------------------------------------------------------------------------------------- |
| Nombre     | obligatorio, máx. 150                                                                   |
| Email      | `^[^\s@]+@[^\s@]+\.[^\s@]+$`, máx. 254                                                  |
| Username   | `^[a-zA-Z0-9_]{3,30}$`                                                                  |
| Teléfono   | opcional; `^\+?[0-9]{9,15}$`. **Vacío = se omite del JSON** (con `""` IAM responde 400) |
| Contraseña | 8–72 caracteres (más: ≤ 72 **bytes** UTF-8, por el límite de BCrypt)                    |
| Perfil     | `GASTRONOMIC_EXPLORER` o `HUARIQUE_OWNER`                                               |

Tras autenticarse: Explorador → `/radar`. Dueño → consulta `GET /business-api/huariques/me`: `404` →
`/owner/onboarding`, existe → `/owner/dashboard`. Si Business no responde, el dueño entra al dashboard con
un aviso.

Errores en el mismo formulario: `409` (correo o usuario ya registrados; IAM usa el mismo texto para ambos),
`401` (credenciales) y `400` (datos inválidos). Un `401` de una petición **con** token cierra la sesión y
lleva a `/login`; el `401` de un login fallido no.

### Sesión y almacenamiento del token

El JWT se guarda en `sessionStorage` (más memoria). Trade-off:

- ➕ Se borra al cerrar la pestaña y no se comparte entre pestañas; sobrevive a recargar.
- ➖ Cualquier script de la página puede leerlo: un XSS lo expone. Una cookie `httpOnly` lo evitaría pero
  exige cambios en IAM (emisión de cookie, CSRF) que hoy no existen.
- Mitigaciones: no usar `v-html` con datos de usuario, CSP estricta al desplegar, cierre de sesión
  automático al llegar a `exp`. **No pasar el token a `localStorage` sin decisión del equipo.**

El JWT se decodifica **solo** para leer `role` y `exp` (UX); la firma la valida el backend.

### Guards por rol

`meta.public`, `meta.guestOnly` y `meta.role` en `src/app/router.js`; la regla vive en
`src/app/guards.js` (`resolveNavigation`, función pura). Sin sesión → `/login`; rol incorrecto → `/403`;
ruta inexistente → `/404`.

## Problemas conocidos del backend (a fecha 2026-11-24)

- **Business rechaza los tokens de IAM** (falta `iss`/`aud`, rol `OWNER` vs `HUARIQUE_OWNER`). Mientras no
  se resuelva, `GET /business-api/huariques/me` responderá `401` y, por la regla del cliente HTTP, la
  sesión del dueño se cerrará justo después de iniciar sesión. Ver `Foodly-Business-Service/docs/iam-business-jwt.md`
  y la sección 3.1 del `CLAUDE.md` del workspace.
- Radar y Messaging interpretan `JWT_SECRET` distinto que IAM (UTF-8 vs Base64).

## Flujo de trabajo

GitFlow: `feature/web-<descripcion>` desde `develop`, PR hacia `develop`, Conventional Commits en inglés.
Ver `CLAUDE.md` para las reglas completas.
