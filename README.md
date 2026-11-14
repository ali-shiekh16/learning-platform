# Learning Platform

An interactive learning and collaboration platform: live meetings with chat, a collaborative
whiteboard, timed Sudoku with performance reports, and text-to-speech — with Student and
Teacher roles.

- **Spec:** [docs/spec.md](docs/spec.md)
- **Architecture decisions:** [docs/adr/](docs/adr/)
- **Database:** [docs/database.md](docs/database.md)
- **API reference:** `http://localhost:3000/api/docs` (OpenAPI, generated from the route schemas)

## Status

| Module | State |
|---|---|
| 1. Foundation: auth, roles, dashboards, real-time connection | ✅ Done |
| 2. Live meetings + chat | Planned |
| 3. Collaborative whiteboard | Planned |
| 4. Timed Sudoku + reports | Planned |
| 5. Text-to-speech | Planned |
| 6. Deployment | Planned |

## Stack

React 19 + TypeScript + Vite + shadcn/ui · Node.js + Fastify + Socket.IO · PostgreSQL + Prisma ·
better-auth · Zod (shared between client and server). Reasons for each choice are in the ADRs.

## Repository layout

```
apps/web          React single-page app
apps/server       Fastify API + Socket.IO + Prisma
packages/shared   Zod schemas and types used by both
docs/             spec, ADRs, database docs
```

## Running locally

**Requirements:** Node.js 22 or 24 (LTS), Docker Desktop.

```bash
npm install                                   # installs all workspaces
cp apps/server/.env.example apps/server/.env  # then set BETTER_AUTH_SECRET (command in the file)
npm run db:up                                 # Postgres in Docker, on host port 5433
npm run db:migrate -w @app/server             # create tables
npm run db:seed -w @app/server                # demo accounts
npm run dev                                   # API on :3000, web app on :5173
```

Open http://localhost:5173.

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

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API and web app with live reload |
| `npm test` | Server test suite (uses a separate `learning_test` database) |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm run lint` | ESLint |
| `npm run format` | ESLint auto-fix + Prettier |
| `npm run build` | Production build of web and server |

## Code style

Prettier (no semicolons, single quotes, `x => x` arrow functions) and ESLint (no braces around
single-line `if`/`else`/loop bodies). Run `npm run format` before committing.
