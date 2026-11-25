# Lighthouse

Medido el 2026-11-25 sobre el build de producción (`vite preview`), con Lighthouse 13 y Chromium headless.
`/radar` se mide con una sesión de explorador sembrada en `sessionStorage`; se carga sin ubicación compartida (estado inicial).

| Página   | Dispositivo | Rendimiento | Accesibilidad | Buenas prácticas | SEO | Informe                                  |
| -------- | ----------- | ----------: | ------------: | ---------------: | --: | ---------------------------------------- |
| `/login` | mobile      |         100 |           100 |              100 | 100 | [informe](lighthouse/login-mobile.html)  |
| `/login` | desktop     |         100 |           100 |              100 | 100 | [informe](lighthouse/login-desktop.html) |
| `/radar` | mobile      |         100 |           100 |              100 | 100 | [informe](lighthouse/radar-mobile.html)  |
| `/radar` | desktop     |         100 |           100 |              100 | 100 | [informe](lighthouse/radar-desktop.html) |

Reproducir: `VITE_MOCK_RESERVATION=true VITE_MOCK_COMMUNITY=true npm run build && node scripts/lighthouse.mjs` (requiere el gateway en http://localhost:8000).
