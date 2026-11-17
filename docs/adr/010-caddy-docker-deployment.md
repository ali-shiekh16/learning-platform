# ADR 010 — Docker Compose on a single VM, with Caddy in front

**Status:** Accepted

## Context
The app needs a public HTTPS address: browsers only allow camera and microphone on secure origins, and the session cookie is marked `Secure` in production. The API and the SPA must share one origin (ADR 002, ADR 006), and Socket.IO needs WebSocket upgrades to pass through. Live whiteboards and the chat rate limiter are kept in one process's memory, so exactly one API server runs. It is hosted on a single Oracle Cloud ARM (A1) VM.

## Decision
Run everything with **Docker Compose** (`compose.prod.yml`) on one VM, with **Caddy** as the only public entry point:

- **caddy** serves the built SPA, proxies `/api/*` and `/socket.io/*` to the server, and obtains and renews the TLS certificate (Let's Encrypt).
- **server** is the Fastify + Socket.IO process, built into `dist/` and run with production dependencies only.
- **db** is PostgreSQL 17, reachable only from the other containers.
- **migrate** runs `prisma migrate deploy` and exits; the server starts only after it succeeds. The same image runs the demo seed.

## Reasons
- **HTTPS without extra moving parts.** Caddy handles certificates itself; nginx would need certbot, a shared challenge directory and a reload after each renewal.
- **Correct proxy defaults.** Caddy forwards WebSocket upgrades and sets `X-Forwarded-For/Proto/Host` by default. With `TRUST_PROXY=true`, rate limits and sessions see the visitor's IP and better-auth builds `https://` URLs.
- **Node only serves the API.** Static files, compression and cache headers stay in Caddy, so no static-file plugin is needed in Fastify.
- **One VM fits the architecture.** A single API process is a stated limit (in-memory boards and limiters), and one VM keeps the database close to the server at no cost.
- **Same images everywhere.** The stack runs the same way on a laptop (`APP_DOMAIN=localhost`, Caddy's local certificate) as on the VM, and all base images are multi-arch, so it builds natively on ARM.

## Alternatives considered
- **nginx + certbot.** Equally capable and more widely known, but more configuration for the same result: TLS settings, forwarded headers, WebSocket `Upgrade`/`Connection` headers, and certificate renewal.
- **Fastify serving the SPA (`@fastify/static`).** Removes one container, but Node would still need TLS termination in front of it, and caching and compression would be configured in application code.
- **A managed platform (Render, Railway).** Less to operate, but free tiers sleep after inactivity, which drops socket connections and makes the first visit slow. Managed Postgres free tiers also expire or are size-limited.

## Consequences
- Releases rebuild the images on the VM; each one has a few seconds of downtime while the server restarts.
- The `caddy-data` volume holds the certificates and must be kept, or Let's Encrypt rate limits can be reached on repeated restarts.
- Backups are our job: a scheduled `pg_dump` of the `db` container.
- Scaling to several API servers would need the Socket.IO Redis adapter and a shared store (`docs/improvements.md` #9), plus a load balancer in place of the single Caddy.
- The server image is larger than its runtime needs. better-auth declares `prisma` and `vitest` as optional peer dependencies, and npm installs them because they are in the lockfile. They are never loaded, so they cost disk space only.
