# syntax=docker/dockerfile:1

# ---- build: compile the SPA with Node --------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# The browser talks to nginx on the same origin and nginx forwards the API paths to the gateway
# (see nginx/default.conf.template), so the bundle needs no absolute API URL and no CORS.
# Reservation and Community have no API yet: the production image runs them on the mocks too.
# Flip these two build args to "false" once those services exist.
ARG VITE_MOCK_RESERVATION=true
ARG VITE_MOCK_COMMUNITY=true
ENV VITE_API_GATEWAY_URL="" \
    VITE_MOCK_RESERVATION=$VITE_MOCK_RESERVATION \
    VITE_MOCK_COMMUNITY=$VITE_MOCK_COMMUNITY
RUN npm run build

# ---- runtime: static files with nginx (SPA fallback + API proxy) -----------------------------
FROM nginx:1.27-alpine AS runtime

# The official image renders every *.template in this folder with envsubst at start-up.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/api-proxy.conf /etc/nginx/api-proxy.conf
COPY --from=build /app/dist /usr/share/nginx/html

# host:port of Kong, where nginx forwards /iam, /business-api, /radar/, /messaging,
# /reservation-api and /community. Override it at run time (docker run -e API_GATEWAY_HOST=...).
ENV API_GATEWAY_HOST=host.docker.internal:8000
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q --spider http://127.0.0.1/healthz || exit 1
