# Foodly WebApp

Aplicación web de Foodly (curso 1ASI0728, UPC). Cliente para dos perfiles:

- **Explorador Gastronómico** (`GASTRONOMIC_EXPLORER`): Radar H3, detalle de huarique, favoritos, Lía, reservas y reseñas.
- **Dueño de Huarique** (`HUARIQUE_OWNER`, "Foodly Admin"): onboarding, dashboard, carta, galería, reservas y reputación.

## Stack

Vue 3 + Vite · JavaScript (sin TypeScript) · Vue Router · Pinia · ESLint (`eslint-plugin-vue` recommended) + Prettier ·
Vitest + `@vue/test-utils` · Playwright (e2e) · Leaflet + OpenStreetMap + `h3-js` · `@stomp/stompjs` · `qrcode`.
Sin librerías de UI: componentes propios con variables CSS.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # PowerShell: Copy-Item .env.example .env.local
npm run dev                  # http://localhost:5173
```

Requisitos: Node 20+ (probado con 22 y 24). Para usar el backend real: `foodly-infra\start-all.ps1` (Kong en `:8000`).

| Script                              | Qué hace                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `npm run dev`                       | Servidor de desarrollo con proxy al gateway                               |
| `npm run build` / `npm run preview` | Build de producción / servirlo localmente                                 |
| `npm run lint` · `npm run format`   | ESLint · Prettier                                                         |
| `npm run test`                      | Vitest (unitarios y de componentes, sin red)                              |
| `npm run e2e`                       | Playwright contra el backend real; **se omite si el gateway no responde** |

Antes de abrir un PR deben pasar `npm run lint`, `npm run test` y `npm run build`.

### Variables de entorno

Copiar `.env.example` a `.env.local` (ignorado por git). Todo `VITE_*` queda **público** en el bundle: nunca poner secretos.

| Variable                | Uso                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `VITE_API_GATEWAY_URL`  | URL de Kong (`http://localhost:8000`). Destino del proxy en desarrollo; base URL en un build sin nginx. |
| `VITE_MOCK_RESERVATION` | `true` mientras Reservation no tenga API (hoy no la tiene).                                             |
| `VITE_MOCK_COMMUNITY`   | `true` mientras Community no tenga API (hoy no la tiene).                                               |

## Conexión con el backend

Todo el tráfico va al API Gateway Kong. En desarrollo, Vite hace de proxy de `/iam`, `/business-api`, `/radar`, `/messaging`
(con WebSocket), `/reservation-api` y `/community`, así el navegador solo habla con `localhost:5173` y **no hay CORS**.
`/radar` es a la vez ruta de la SPA y prefijo de API: las navegaciones `text/html` reciben la app y los `fetch` JSON van a Kong.

**Reservation y Community aún no tienen API.** Cada uno tiene una interfaz común y dos adaptadores, elegidos por flag:

| Servicio                        | Mock (localStorage)                                                                  | HTTP (contrato del informe)                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Favoritos (`FavoriteService`)   | por usuario, sin duplicados                                                          | `GET /community/favorites/me`, `POST`/`DELETE /community/favorites/{id}` (5.4.2)                     |
| Reseñas (`ReviewService`)       | compartido entre cuentas del navegador                                               | `GET`/`POST /community/huariques/{id}/reviews` (5.4.2)                                               |
| Reservas (`ReservationService`) | compartido entre cuentas: un explorador reserva y el dueño aprueba desde otra cuenta | `POST /reservation-api/reservations`, `GET …/me`, `GET …/huarique/{id}`, `PUT …/{id}/status` (5.5.2) |

El plato de interés y la nota de Lía viajan dentro de `notes` (una línea cada una), porque el contrato solo tiene ese campo.

## Arquitectura

Organización por bounded context, igual que `AppMobile-FoodNode`:

```
src/
  app/                  router, guards, layouts, vistas globales (login, 403, 404), bootstrap, App.vue
  shared/
    config/ http/       lectura de entorno · cliente fetch (Bearer, JSON, multipart, timeout, errores en español)
    geo/                H3, distancias, distritos de Lima, geolocalización
    ui/                 tokens.css, base.css y componentes base (AppButton, AppInput, AppMap, StatusBadge, ...)
    utils/              jwt, formato, polling
  contexts/<iam|radar|business|community|reservation|messaging>/
    domain/ infrastructure/ application/ interfaces/
```

Los componentes **nunca** llaman al backend: vista → store/composable → `XxxService` → `shared/http`.
Un contexto no importa la infraestructura de otro; usa su `application` (stores). `app/` orquesta varios contextos.

## Pantallas

Rutas: explorador `/radar`, `/huariques/:id`, `/huariques/:id/reservar`, `/favoritos`, `/mensajes/:id?`, `/reservas`,
`/reservas/:id`, `/reservas/:id/ruta`, `/profile`; dueño `/owner/onboarding`, `/owner/dashboard`, `/owner/reservations`,
`/owner/menu`, `/owner/gallery`, `/owner/profile`; públicas `/login`, `/403`, `/404`. Los guards usan `meta.role`.

Las capturas se regeneran con `E2E_SCREENSHOTS=1 npm run e2e -- screenshots` (usan el backend real y los mocks de Reservation y Community).

### W1 · Registro / Inicio de sesión (UF-W1)

| Inicio de sesión                                      | Registro                                         |
| ----------------------------------------------------- | ------------------------------------------------ |
| ![W1 inicio de sesión](docs/screenshots/w1-login.png) | ![W1 registro](docs/screenshots/w1-registro.png) |

Endpoints: `POST /iam/auth/register`, `POST /iam/auth/login`, `GET /iam/users/me`. Validaciones espejo de IAM
(`RegisterUserResource`): nombre ≤150, email, username `^[a-zA-Z0-9_]{3,30}$`, teléfono opcional `^\+?[0-9]{9,15}$`
(vacío = se omite del JSON), contraseña 8–72 caracteres (y ≤72 bytes por BCrypt). Tras autenticarse: explorador → `/radar`;
dueño → `GET /business-api/huariques/me`: 404 → `/owner/onboarding`, existe → `/owner/dashboard`.

**Token:** `sessionStorage` (se borra al cerrar la pestaña, sobrevive a recargas). Trade-off: un XSS podría leerlo; una cookie
`httpOnly` evitaría eso pero exige cambios en IAM. Se decodifica solo para leer `role` y `exp`; al expirar se cierra la sesión.
Un 401 de una petición **con** token cierra la sesión y lleva a `/login`.

### W2 · Radar H3 (UF-W2)

| Escritorio                                                       | Móvil                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| ![W2 radar escritorio](docs/screenshots/w2-radar-escritorio.png) | ![W2 radar móvil](docs/screenshots/w2-radar-movil.png) |

«Compartir Mi Ubicación» (si se niega: explicación, distrito fijo o arrastrar el marcador), `POST /radar/search`
(`kRing` 1–5, por defecto 2), celdas H3 (resolución 9, `gridDisk`) dibujadas en el mapa, tarjetas ordenadas por distancia
completadas con `GET /business-api/huariques/{id}` en paralelo (caché 60 s, tolera 404), filtros en el cliente
(texto, categoría `CuisineType`, nivel de precio, «Abierto Ahora»), esqueletos, estado vacío y error con reintento.
En modo dev muestra el tiempo de la búsqueda (RNF-01, máx. 2 s). Radar devuelve solo id, coordenadas y distancia;
nombre, foto y estado salen de Business.

### W3 · Detalle y favoritos (US-07, US-08, US-11)

| Detalle                                        | Favoritos                                          |
| ---------------------------------------------- | -------------------------------------------------- |
| ![W3 detalle](docs/screenshots/w3-detalle.png) | ![W3 favoritos](docs/screenshots/w3-favoritos.png) |

### Lía (chat)

![Lía](docs/screenshots/lia-chat.png)

`POST /messaging/chat` responde 202; la respuesta llega por STOMP (`/messaging/ws`, JWT en el `CONNECT`) a
`/topic/conversations/{id}`. Si el socket no conecta, polling cada 2 s hasta 25 s. Mensajes de hasta 1000 caracteres,
mostrados al instante. La API no tiene campo `huariqueId`: va como prefijo `[huarique:<uuid>]` del texto y se oculta al mostrarlo.
Lía escribe las recomendaciones como texto («1. Nombre (a 320 m)»): las tarjetas se obtienen emparejando esos nombres con una
búsqueda de Radar. Los avisos de reserva manual (RF-15) se detectan por su frase.

### W4 · Reserva confirmada · reseña verificada (UF-W4)

| Solicitud                                          | Pendiente                                               | Aprobada, pase y voucher                              | Reseña verificada                                    |
| -------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
| ![reservar](docs/screenshots/w4-reservar-mesa.png) | ![pendiente](docs/screenshots/w4-reserva-pendiente.png) | ![aprobada](docs/screenshots/w4-reserva-aprobada.png) | ![reseña](docs/screenshots/w4-resena-verificada.png) |

El formulario valida que la hora esté dentro de los `openingHours` del día. Estados: `PENDING → APPROVED | REJECTED | EXPIRED`,
`APPROVED → COMPLETED | EXPIRED`. La reseña solo se habilita con la reserva `APPROVED` o `COMPLETED` y sin reseña previa
(etiqueta «Reserva Verificada»).

### W5 · Cómo llegar

![W5](docs/screenshots/w5-como-llegar.png)

El alcance excluye el cálculo de rutas: línea recta entre el usuario y el huarique, distancia, zona H3 y enlace a Google Maps.
«Ya llegué al local» (check-in) pasa la reserva a `COMPLETED`.

### W6 · Onboarding del dueño (UF-W5)

| Paso 1                                                    | Paso 2                                                    | Paso 3                                                   |
| --------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------- |
| ![paso 1](docs/screenshots/w6-onboarding-1-identidad.png) | ![paso 2](docs/screenshots/w6-onboarding-2-ubicacion.png) | ![paso 3](docs/screenshots/w6-onboarding-3-horarios.png) |

«Publicar Huarique y Activar Radar» hace `POST /business-api/huariques` → `PUT …/menu` (sin `version` la primera vez) →
`PATCH …/open-status {OPEN}`, porque Business crea el huarique `CLOSED`. El borrador se guarda en `localStorage`; si falla un
paso intermedio, el reintento continúa donde quedó. 409 → «Ya tienes un huarique registrado».

### W7 · Gestión y edición (UF-W6)

| Dashboard                                       | Carta y precios                                   | Galería                                     | Reputación                                        |
| ----------------------------------------------- | ------------------------------------------------- | ------------------------------------------- | ------------------------------------------------- |
| ![dashboard](docs/screenshots/w7-dashboard.png) | ![carta](docs/screenshots/w7-carta-y-precios.png) | ![galería](docs/screenshots/w7-galeria.png) | ![reputación](docs/screenshots/w7-reputacion.png) |

Cada respuesta de Business trae la `version`, que se envía en la siguiente escritura. Con 409 por versión vieja se recarga y se
avisa «Alguien actualizó este huarique, revisa los cambios.». Tras guardar: «Visible en el Radar en unos segundos» (RNF-08).
Las respuestas de imágenes no traen versión: se vuelve a leer el recurso.

### W8 · Gestión de reservas de Lía (dueño)

| Pendientes                                                 | Aprobadas                                                |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| ![pendientes](docs/screenshots/w8-reservas-pendientes.png) | ![aprobadas](docs/screenshots/w8-reservas-aprobadas.png) |

## Pruebas y calidad

- **Vitest**: dominio (validaciones, reglas de reserva y reseña, filtros), servicios (payloads exactos), stores (chat optimista,
  deduplicación, polling, versiones, wizard) y componentes.
- **Playwright** (`e2e/`): dueño publica y el explorador lo ve en el Radar; responsive 360/768/1280 + axe (WCAG AA) + teclado;
  enlaces profundos. Detalle y resultados: [`docs/E2E.md`](docs/E2E.md).
- **Lighthouse** (`/login` y `/radar`, móvil y escritorio): 100 en las cuatro categorías. Ver [`docs/LIGHTHOUSE.md`](docs/LIGHTHOUSE.md).

## Docker

```bash
docker build -t foodly-webapp .
docker run -p 8090:80 -e API_GATEWAY_HOST=host.docker.internal:8000 foodly-webapp
```

Build multi-stage: Node compila y nginx sirve el SPA con fallback a `index.html`; nginx reenvía `/iam`, `/business-api`, `/radar/`,
`/messaging` (WebSocket incluido), `/reservation-api` y `/community` a Kong, así que no hace falta CORS. Los args
`VITE_MOCK_RESERVATION` y `VITE_MOCK_COMMUNITY` valen `true` por defecto.

Servicio opcional en `foodly-infra/docker-compose.yml` (perfil `webapp`, no arranca con `start-all.ps1`):
`docker compose --profile webapp up -d --build webapp` → http://localhost:8090.

`@emnapi/core` y `@emnapi/runtime` están fijados como devDependencies porque el lockfile generado en Windows no los incluye y
`npm ci` falla en Linux sin ellos.

## Flujo de trabajo

GitFlow: `feature/web-<descripcion>` desde `develop`, PR hacia `develop`, Conventional Commits en inglés. Reglas completas en `CLAUDE.md`.
