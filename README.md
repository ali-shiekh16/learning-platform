# Learning Platform

An interactive learning and collaboration platform: live meetings with chat, a collaborative
whiteboard, timed Sudoku with performance reports, and text-to-speech — with Student and
Teacher roles.

- **Live demo:** https://learn.aleee.live (sign in with one of the [demo accounts](#demo-accounts))
- **Spec:** [docs/spec.md](docs/spec.md) (including the assumptions that fill gaps in the brief, §9)
- **Architecture decisions:** [docs/adr/](docs/adr/) (ADR 001–010)
- **Database:** [docs/database.md](docs/database.md)
- **API reference:** https://learn.aleee.live/api/docs, or `http://localhost:3000/api/docs` locally
  (OpenAPI, generated from the route schemas)
- **Known limitations and next steps:** [docs/improvements.md](docs/improvements.md)

## Status

| Module | State |
|---|---|
| 1. Foundation: auth, roles, dashboards, real-time connection | ✅ Done |
| 2. Live meetings + chat | ✅ Done |
| 3. Collaborative whiteboard | ✅ Done |
| 4. Timed Sudoku + performance reports | ✅ Done |
| 5. Text-to-speech | ✅ Done |
| 6. Deployment: Docker Compose + Caddy | ✅ Done |

## What it does

**Accounts and roles.** Email/password sign-in (better-auth, cookie sessions). Self sign-up
creates students; teachers are seeded. Every API route and socket event checks the role and
ownership on the server; the UI only hides what a user can't use.

**Live meetings.** A teacher starts a meeting and shares a 6-character join code. Video and audio
go through LiveKit Cloud (camera and mic start off; screen sharing included). The teacher can
mute or remove participants and end the meeting for everyone. Removal and ending are enforced in
the database first, then in LiveKit, then in the browsers.

**Chat.** Real-time over Socket.IO; messages are validated, rate-limited, saved before they are
broadcast, timestamped by the server, and paged with a cursor. Each message has a 🔊 button that
reads it aloud.

**Whiteboard.** Excalidraw in the room's main area (Video | Whiteboard switch), with everyone's
video beside it. Our own sync layer sends only changed shapes, merges by version, keeps undo
local, shows live cursors and saves the board. Boards start locked; the teacher unlocks, locks
and clears.

**Timed Sudoku.** Students pick Easy, Medium or Hard. Puzzles are generated on the server with
exactly one solution; the solution never reaches the browser. Every move is checked and logged
by the server, which also owns the timer. Five mistakes, the time running out, quitting or
solving ends the game.

**Performance reports.** Shown as soon as a game ends: result, score, correct entries,
mistakes, accuracy, time and the final grid with wrong cells marked. Students see their history;
teachers see a filterable, sortable table of the students who attended their meetings.

**Text-to-speech.** At `/tools/tts` and as a tab in every meeting: voices the browser offers
(grouped by language, remembered), speed and pitch, Play / Pause / Resume / Stop, and a
read-along view highlighting the sentence and word being spoken. Uses the browser's Web Speech
API behind a small engine interface ([ADR 009](docs/adr/009-tts-browser-engine.md)).

## Architecture

```
Browser (React SPA)                           Server (Node.js)
  pages / components                            Fastify routes ──┐
        │ only through hooks (lint-enforced)    Socket.IO handlers ┼─► services ─► Prisma ─► PostgreSQL
  hooks (React Query, sockets, speech)          (validated with    │       │
        │                                        shared Zod schemas)│       └─► LiveKit gateway ─► LiveKit Cloud
  services (fetch, validated responses) ── REST /api ───────────────┘
  socket ─────────────────────────────── WebSocket /socket.io

packages/shared: Zod schemas, types and socket event maps used by both sides
```

- **One origin.** In development Vite proxies `/api` and `/socket.io` to Fastify, so the session
  cookie works without CORS. In production Caddy does the same: it serves the built app and
  proxies `/api` and `/socket.io` to the server ([ADR 010](docs/adr/010-caddy-docker-deployment.md)).
- **Services own the rules, routes and handlers only translate.** Services are created in one
  place (`apps/server/src/app.ts`) and receive their dependencies, so tests swap LiveKit for a
  fake and control the Sudoku clock.
- **Errors** have one shape everywhere: `{ error: { code, message } }`, for REST and socket acks.

## Repository layout

```
apps/web          React single-page app
apps/server       Fastify API + Socket.IO + Prisma
packages/shared   Zod schemas and types used by both
docs/             spec, ADRs, database docs, improvements backlog

Dockerfile        production images: server, web (Caddy + built app), tools (migrations, seed)
compose.prod.yml  production stack: caddy, server, db, migrate
Caddyfile         HTTPS, static files, proxy to the API
```

## Running locally

**Requirements:** Node.js 22 or 24 (LTS), Docker Desktop, and a free
[LiveKit Cloud](https://cloud.livekit.io) project for video (everything else works without it).

```bash
npm install                                   # installs all workspaces
cp apps/server/.env.example apps/server/.env  # set BETTER_AUTH_SECRET and the LIVEKIT_* keys
npm run db:up                                 # Postgres in Docker, on host port 5433
npm run db:migrate -w @app/server             # create tables
npm run db:seed -w @app/server                # demo accounts
npm run dev                                   # API on :3000, web app on :5173
```

Open http://localhost:5173. To try two roles at once, use a second browser or a private window.

### Demo accounts

All use the password `password123`.

| Email | Role |
|---|---|
| teacher@demo.test | Teacher |
| teacher2@demo.test | Teacher |
| student@demo.test | Student |
| student2@demo.test | Student |
| student3@demo.test | Student |

New sign-ups are always students; teacher accounts are provisioned (seeded).

## Tests

```bash
npm test     # server and web tests
```

- **Server (81 tests, Vitest):** real HTTP and Socket.IO against a separate `learning_test`
  database (reset and migrated before each run): auth and roles, meetings and moderation, chat,
  whiteboard sync and locking, the Sudoku engine, moves, timer, scoring and reports. Concurrency
  guarantees (the move row lock, one open game per student) have tests that fail without them.
- **Web (19 tests, Vitest):** the text-to-speech logic: sentence splitting, voice choice, and the
  browser speech engine against a fake `speechSynthesis`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API and web app with live reload |
| `npm test` | Server and web test suites |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm run lint` | ESLint (including the frontend layering rules) |
| `npm run format` | ESLint auto-fix + Prettier |
| `npm run build` | Production build of web and server |

## Deployment

Production runs as one Docker Compose stack on a single VM (Oracle Cloud ARM, A1). Why this
setup: [ADR 010](docs/adr/010-caddy-docker-deployment.md).

```
Internet ──► caddy :80/:443 ──┬─ /api/*, /socket.io/* ──► server :3000 ──► db (Postgres 17)
                              └─ everything else ──► built SPA        └──► LiveKit Cloud
```

- **caddy** gets and renews the HTTPS certificate, serves the SPA (unknown paths fall back to
  `index.html`, hashed assets are cached for a year) and proxies the API and sockets.
- **server** runs `node dist/index.js` as a non-root user. It saves open whiteboards when it
  receives SIGTERM, and Compose gives it 20 s to stop.
- **migrate** applies pending migrations and exits. The server starts only after it succeeds,
  so every `up` migrates first.
- **db** has no published port. Data lives in the `db-data` volume, certificates in `caddy-data`.

### Server prerequisites

- Docker Engine with the Compose plugin.
- A DNS **A record** for the domain pointing at the server's public IP.
- Inbound TCP **80 and 443** open. On Oracle Cloud that means both the VCN security list and the
  instance's own `iptables` rules.

### First deploy

```bash
cp .env.production.example .env      # set APP_DOMAIN, POSTGRES_PASSWORD, BETTER_AUTH_SECRET, LIVEKIT_*
chmod 600 .env
docker compose -f compose.prod.yml up -d --build
docker compose -f compose.prod.yml run --rm migrate npm run db:seed    # demo accounts, once
```

`BETTER_AUTH_URL` (`https://` + `APP_DOMAIN`) and `TRUST_PROXY` are set in `compose.prod.yml`.
The socket server only accepts connections from that exact origin.

### Updating

```bash
git pull
docker compose -f compose.prod.yml up -d --build
```

### Operations

```bash
docker compose -f compose.prod.yml ps                   # status and health
docker compose -f compose.prod.yml logs -f server       # logs (rotated, 3 × 10 MB per service)
docker compose -f compose.prod.yml exec -T db pg_dump -U app learning | gzip > backup-$(date +%F).sql.gz
```

### Trying the production stack locally

Set `APP_DOMAIN=localhost` in an env file and pass it with `--env-file`. Caddy then uses its own
local certificate, so the browser shows a warning once. Use `https://localhost`, not
`127.0.0.1`: the server only accepts the origin built from `APP_DOMAIN`.

## Known limitations

Deliberate trade-offs for the scope of an assessment; each is described with its fix in
[docs/improvements.md](docs/improvements.md).

- **Single server process.** Live whiteboards, the chat and drawing rate limiters live in one
  process's memory. Running several API servers would need the Socket.IO Redis adapter and a
  shared store.
- **Whiteboard:** no images yet (they need uploads and storage); a crash can lose the last ~2 s of
  drawing; past meetings' boards are saved but have no viewer yet.
- **Text-to-speech** quality and voice choice depend on the browser and device; some voices don't
  report word positions, so only the sentence is highlighted. Natural cloud voices are a
  documented next step (ADR 009).
- **Sudoku** has no pencil notes.
- **Video** needs a LiveKit Cloud project (free tier); without keys, meetings work but video
  doesn't connect.

## Code style

Prettier (no semicolons, single quotes, `x => x` arrow functions) and ESLint (no braces around
single-line `if`/`else`/loop bodies). Run `npm run format` before committing.
