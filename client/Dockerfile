FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite bakes VITE_* at build time. Without this, dist/ ships with
# http://localhost:5000/api and bypasses the nginx /api proxy in prod.
ARG VITE_API_URL=/api
ARG VITE_APP_URL=
ARG VITE_ADMIN_ROUTE_PREFIX=admin
ENV VITE_API_URL=$VITE_API_URL VITE_APP_URL=$VITE_APP_URL VITE_ADMIN_ROUTE_PREFIX=$VITE_ADMIN_ROUTE_PREFIX
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
