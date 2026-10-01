FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite bakes VITE_* at build time. Forward API URL and masked admin prefix.
ARG VITE_API_URL=/api
ARG VITE_APP_URL=
ARG ADMIN_ROUTE_PREFIX=/api/admin
ARG VITE_ADMIN_ROUTE_PREFIX=
RUN if [ -z "$VITE_ADMIN_ROUTE_PREFIX" ] && [ -n "$ADMIN_ROUTE_PREFIX" ]; then \
      PREFIX="${ADMIN_ROUTE_PREFIX#/api/}"; \
      PREFIX="${PREFIX#/}"; \
      VITE_ADMIN_ROUTE_PREFIX="$PREFIX"; \
    fi; \
    export VITE_API_URL="${VITE_API_URL:-/api}" \
           VITE_APP_URL="${VITE_APP_URL:-}" \
           VITE_ADMIN_ROUTE_PREFIX="${VITE_ADMIN_ROUTE_PREFIX:-admin}"; \
    npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
