FROM node:20-alpine AS base
WORKDIR /app/server
# sharp (libvips) needs libc6-compat on Alpine
RUN apk add --no-cache libc6-compat
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS production
ENV NODE_ENV=production
# Build context is the repo root (see docker-compose.yml), so that
# server code + shared/ + config/ keep the same relative layout as local dev.
# Previously only src/ + index.js were copied, which crashed the container
# with "Cannot find module" for shared/, config/default.json, migrations/
# and public/no-image.png.
COPY server/src/ ./src/
COPY server/index.js ./
COPY server/migrations/ ./migrations/
COPY server/seeders/ ./seeders/
COPY server/.sequelizerc ./
COPY server/public/ ./public/
COPY shared/ /app/shared/
COPY config/ /app/config/
RUN mkdir -p /app/server/uploads && chown -R node:node /app
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 CMD wget -qO- http://localhost:5000/health || exit 1
CMD ["node", "index.js"]
