# syntax=docker/dockerfile:1
#
# Production images, built from the repository root (see compose.prod.yml):
#   server  Fastify API + Socket.IO (production dependencies only)
#   web     Caddy serving the built SPA and proxying /api and /socket.io to the server
#   tools   full toolchain for one-off jobs: database migrations and the demo seed
#
# All base images are multi-arch, so this builds natively on ARM (Oracle A1) and x86.

ARG NODE_IMAGE=node:24-bookworm-slim

# ─── build: install everything, generate the Prisma client, build web + server ───
FROM ${NODE_IMAGE} AS build
WORKDIR /app

# Manifests first, so dependency installs are cached until package*.json change.
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund

COPY . .

# prisma.config.ts reads DATABASE_URL; generating the client never connects to it.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run db:generate -w @app/server \
 && npm run build

# ─── tools: migrations (`prisma migrate deploy`) and seeding need dev dependencies ───
FROM build AS tools
ENV NODE_ENV=production
USER node
WORKDIR /app/apps/server
CMD ["npm", "run", "db:deploy"]

# ─── server: production dependencies + the bundled server ───
FROM ${NODE_IMAGE} AS server
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --workspace=@app/server --no-audit --no-fund \
 && npm cache clean --force

# The bundle already contains @app/shared and the generated Prisma client.
COPY --from=build /app/apps/server/dist apps/server/dist

USER node
WORKDIR /app/apps/server
EXPOSE 3000
# Run node directly (not through npm) so it receives SIGTERM and saves open whiteboards.
CMD ["node", "dist/index.js"]

# ─── web: Caddy with the built SPA ───
FROM caddy:2-alpine AS web
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
