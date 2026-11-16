# Specification — Interactive Learning & Collaboration Platform

A single web application that combines live meetings, real-time chat, a timed Sudoku game with performance reports, a collaborative whiteboard and text-to-speech, with Student and Teacher roles.

Architecture decisions and their reasoning are recorded in [`docs/adr/`](adr/).

---

## 1. Stack

| Layer | Choice | ADR |
|---|---|---|
| Language | TypeScript end-to-end | [001](adr/001-typescript-full-stack.md) |
| Frontend | React + Vite, React Router, TanStack Query, Zustand | [002](adr/002-vite-spa-over-nextjs.md) |
| UI components | shadcn/ui (Radix + Tailwind) | [003](adr/003-shadcn-ui.md) |
| Backend | Node.js + Fastify (`fastify-type-provider-zod`, `@fastify/swagger`) | [004](adr/004-fastify-backend.md) |
| Real-time | Socket.IO (same process as the API) | [005](adr/005-socketio-realtime.md) |
| Database | PostgreSQL + Prisma | [001](adr/001-typescript-full-stack.md) |
| Auth | better-auth (email/password, database sessions) | [006](adr/006-better-auth.md) |
| Validation | Zod schemas in a shared package | [004](adr/004-fastify-backend.md) |
| Audio/video | LiveKit Cloud (React components + Node server SDK) | [007](adr/007-livekit-video.md) |
| Whiteboard | Excalidraw + custom sync layer over Socket.IO | [008](adr/008-excalidraw-whiteboard.md) |
| Text-to-speech | Browser Web Speech API | — |
| Tests | Vitest | — |
| Delivery | Docker Compose; hosted on Render/Railway | — |

---

## 2. Architecture

```
                 same origin (Fastify serves the built SPA in prod; Vite proxies /api in dev)
React SPA ──REST/JSON──► Fastify API ──Prisma──► PostgreSQL
    │ ◄──Socket.IO─────► (same Node process)
    │                          │
    └──WebRTC media──► LiveKit Cloud ◄── server SDK: tokens, mute, remove, delete room
```

- **REST** — request/response work: auth, meetings, Sudoku moves, reports.
- **Socket.IO** — live state: chat, whiteboard sync, meeting control events. One room per meeting: `meeting:<id>`.
- **LiveKit** — audio/video transport. Its client SDK provides per-participant mic/camera state. Our server only mints tokens and calls the admin API for teacher actions.
- **Same origin** — the API and SPA are served from one origin so session cookies work without cross-site configuration.

### Repository layout (npm workspaces)

```
apps/web          React SPA (Vite, shadcn/ui)
apps/server       Fastify + Socket.IO + Prisma + better-auth
packages/shared   Zod schemas, socket event types, shared constants
docs/             spec, ADRs, database docs
docker-compose.yml
```

---

## 3. Roles & permissions

| Action | Student | Teacher |
|---|:-:|:-:|
| Log in, see dashboard | ✅ | ✅ |
| Create / end a meeting | ❌ | ✅ (own meetings) |
| Join a live meeting | ✅ | ✅ |
| Mute / remove a participant | ❌ | ✅ (own meetings) |
| Chat | ✅ | ✅ |
| Draw on the whiteboard | ✅ when unlocked | ✅ |
| Lock / clear the whiteboard | ❌ | ✅ (own meetings) |
| Play Sudoku | ✅ | ❌ |
| View reports | own only | students who attended their meetings |
| Text-to-speech | ✅ | ✅ |

Permissions are **enforced on the server** — in REST route guards and inside every socket event handler. The UI hides controls the user cannot use, but never relies on that for security.

**Accounts:** demo teacher and student accounts are seeded. Self-registration always creates a Student; the role cannot be chosen by the client.

---

## 4. Database

better-auth owns its core tables; the rest are application tables. IDs are strings (cuid) to match better-auth.

```
user                 id, name, email (unique), emailVerified, image, createdAt, updatedAt,
                     role (string: "STUDENT" | "TEACHER", default "STUDENT")   ← additional field, input: false
session              id, userId → user, token (unique), expiresAt, ipAddress, userAgent, ...
account              id, userId → user, providerId, password (hash), ...
verification         id, identifier, value, expiresAt, ...

meeting              id, title, joinCode (unique, 6 chars), teacherId → user,
                     status ("LIVE" | "ENDED"), createdAt, endedAt

meeting_participant  id, meetingId → meeting, userId → user,
                     joinedAt, leftAt, removed (bool)
                     index (meetingId, userId)

chat_message         id, meetingId → meeting, userId → user, body (≤ 1000 chars), createdAt
                     index (meetingId, createdAt)

whiteboard           meetingId (PK → meeting), elements (JSONB), locked (bool), updatedAt

sudoku_game          id, userId → user, difficulty ("EASY" | "MEDIUM" | "HARD"),
                     puzzle char(81), solution char(81), board char(81),
                     timeLimitS, startedAt, endedAt,
                     status ("IN_PROGRESS" | "COMPLETED" | "TIMED_OUT" | "FAILED" | "ABANDONED"),
                     correctCount, mistakes, score

sudoku_move          id, gameId → sudoku_game, row, col, value, isCorrect, createdAt
```

Notes:
- Role and status columns are strings constrained by Zod/TypeScript unions rather than Prisma enums (better-auth has a known issue with enum-typed additional fields).
- A Sudoku grid is an 81-character string, `0` for empty — compact and trivially comparable.
- A **report** is a finished `sudoku_game` row. It is written once when the game ends, so a separate reports table would duplicate data.
- `sudoku_move` is the progress log and allows replaying a game.

---

## 5. REST API

Error shape for all failures: `{ "error": { "code": string, "message": string, "details"?: unknown } }`.

| Method | Route | Access | Purpose |
|---|---|---|---|
| * | `/api/auth/*` | public | better-auth handler (sign-up, sign-in, sign-out, get-session) |
| GET | `/api/me` | auth | Current user including role |
| GET | `/api/meetings` | auth | Live meetings (teachers also see their own past meetings) |
| POST | `/api/meetings` | teacher | Create meeting + LiveKit room |
| GET | `/api/meetings/:id` | participant | Meeting details |
| POST | `/api/meetings/join` | auth | Join by code; records attendance |
| POST | `/api/meetings/:id/join` | auth, not removed | Enter a live meeting by id (the room page); records attendance |
| POST | `/api/meetings/:id/token` | participant, not removed | Short-lived LiveKit access token |
| POST | `/api/meetings/:id/end` | owner teacher | End meeting, delete LiveKit room |
| POST | `/api/meetings/:id/participants/:userId/mute` | owner teacher | Mute participant's microphone |
| POST | `/api/meetings/:id/participants/:userId/remove` | owner teacher | Remove participant |
| GET | `/api/meetings/:id/messages` | participant | Chat history (cursor paginated) |
| GET | `/api/meetings/:id/whiteboard` | participant | Saved board |
| GET | `/api/sudoku/games/current` | student | The game in progress, or null (for "Resume") |
| POST | `/api/sudoku/games` | student | Start game (ends one still open); returns puzzle, never the solution |
| GET | `/api/sudoku/games/:id` | owner | Resume game (board, time remaining) |
| POST | `/api/sudoku/games/:id/moves` | owner | Place a value; server returns correct/incorrect |
| POST | `/api/sudoku/games/:id/finish` | owner | Finish (time up or quit) |
| GET | `/api/reports` | auth | Student: own. Teacher: their students' (filter by student) |
| GET | `/api/reports/:gameId` | owner or permitted teacher | Single report |

API documentation is generated from the Zod route schemas as an OpenAPI page at `/api/docs` (under `/api` so it never collides with a front-end route).

---

## 6. Socket events

The socket handshake carries the session cookie; the server validates it with `auth.api.getSession()` and rejects the connection otherwise. `meeting:join` checks in the database that the user is a current, non-removed participant; only then does the socket enter the meeting's room. Chat checks the database on every message; the frequent board events instead require membership of that room, which removal and the meeting ending revoke (sockets are taken out of it).

| Direction | Event | Payload |
|---|---|---|
| C → S | `meeting:join` / `meeting:leave` | `{ meetingId }` |
| S → C | `meeting:ended` | `{ meetingId }` |
| S → C | `participant:removed` | `{ meetingId, userId }` — sent to the removed user's own room |
| C → S | `chat:send` (with ack) | `{ meetingId, body }` |
| S → room | `chat:message` | `{ id, meetingId, body, createdAt, sender: { id, name, role } }` — to everyone except the sender, who gets it in the ack |
| C → S | `board:update` | `{ meetingId, elements[] }` — changed elements only |
| S → room | `board:update` | `{ meetingId, elements[] }` — only elements that changed the server's copy |
| C → S | `board:pointer` | `{ meetingId, x, y }` — throttled |
| S → room | `board:pointer` | `{ userId, name, x, y }` |
| teacher C → S | `board:lock` / `board:clear` | `{ meetingId, locked? }` / `{ meetingId }` |
| S → room | `board:locked` | `{ meetingId, locked }` — clearing is sent as `board:update` with every element deleted |

Event names and payload types live in `packages/shared` and are used to type both the server and the client Socket.IO instances.

---

## 7. Modules

### A. Authentication & roles
- better-auth with email/password and **database sessions** stored in Postgres, delivered as an httpOnly, SameSite=Lax cookie. Sessions can be revoked immediately (unlike stateless JWTs).
- `role` is a better-auth additional user field with `input: false` — the client cannot set it at sign-up.
- Seed script creates teachers via better-auth sign-up, then sets `role = "TEACHER"` with a direct Prisma update (`input: false` also blocks the auth API itself).
- Fastify guards: `requireAuth` and `requireRole("TEACHER")`; ownership checks for meetings and reports. Socket connection guard reuses the same session lookup.
- Frontend: protected-route wrapper; dashboard switches on role.
- better-auth's built-in rate limiting protects sign-in.

### B. Live meeting
- Teacher creates a meeting with a title → `meeting` row, 6-character join code, LiveKit room.
- Students join from the list of live meetings or by entering the code.
- Room layout: the main area switches between **Video** (grid of everyone) and **Whiteboard** (the board, with everyone's video in a strip beside it); sidebar tabs **Chat · Participants · TTS**; control bar with mic, camera and screen share; header with join code, leave and (teacher) end meeting. The room uses the full window width.
- Participant list: name, role badge, mic/camera state, join time; teacher sees mute and remove actions.
- **Removal is enforced in three places:** LiveKit `removeParticipant` disconnects the user; `meeting_participant.removed = true` makes the token endpoint refuse new tokens; tokens are short-lived (10 min, only checked at connect) so an old token cannot be reused for long. The client also reacts to `participant:removed` by leaving and returning to the meetings list.
- LiveKit token grants: teacher → `roomAdmin`, `canPublish`, `canSubscribe`; student → `canPublish`, `canSubscribe`.

### C. Chat
- Sent over the socket; server validates (1–1000 chars, trimmed), persists, and broadcasts with a **server timestamp**.
- On join, history is loaded over REST, then live messages stream in.
- Rate limit: 15 messages per 3 seconds per user (raised from 5 during testing; one shared constant, `CHAT_RATE_LIMIT`).
- Each message has a 🔊 button that reads it aloud (TTS integration).

### D. Timed Sudoku
**Generation (server):** randomized backtracking fills a complete grid, then cells are removed one at a time, keeping a removal only if the puzzle still has exactly one solution.

| Difficulty | Givens | Time limit | Multiplier |
|---|---|---|---|
| Easy | 40 | 10 min | ×1.0 |
| Medium | 32 | 15 min | ×1.5 |
| Hard | 26 | 20 min | ×2.0 |

**Integrity:** the solution never leaves the server. Every move is validated by the API, logged in `sudoku_move`, and answered with correct/incorrect.

**Timer:** server-authoritative. Deadline = `startedAt + timeLimitS`. Moves after the deadline are rejected; an expired game is finalized as `TIMED_OUT` the next time it is accessed. The client countdown is display only.

**UI:** 9×9 grid, number pad and keyboard input, highlighting of row/column/box, wrong entries shown in red until changed, mistake counter, countdown that turns red under one minute.

**End states:**
- `COMPLETED` — board solved
- `TIMED_OUT` — deadline passed
- `FAILED` — 5 mistakes reached
- `ABANDONED` — student quit, or started a new game while one was open

**Score:**
```
base      = correctEntries × 10 − mistakes × 20
timeBonus = status == COMPLETED ? remainingSeconds : 0
score     = max(0, round((base + timeBonus) × difficultyMultiplier))
```

### E. Performance report
- Generated automatically when a game ends, for any end state, and shown immediately.
- Contents: status, difficulty, total time, correct entries, mistakes, final score, accuracy % (correct entries ÷ all values placed), final grid with wrong cells marked.
- Students see their own report history. Teachers see a table of students who attended any of their meetings, filterable by student and sortable by score/date, linking to each full report.

### F. Collaborative whiteboard (Excalidraw)
- One board per meeting, shown in the room's main area (Video | Whiteboard switch) so it has room to draw, with participants' video beside it. **Boards start locked**: students watch until the teacher unlocks.
- **Outbound:** only elements whose `version` increased since the last send, batched every ~75 ms.
- **Inbound:** merge by element id — higher `version` wins; `versionNonce` breaks ties. Remote changes are applied without entering the local undo history (`captureUpdate` / `commitToHistory` option), so undo only affects the user's own actions.
- **Deletes:** synced as `isDeleted: true` tombstones.
- **Persistence:** the server merges updates into an in-memory copy per board and writes to Postgres every ~2 s while dirty (one save at a time) and on shutdown; boards unused for 10 minutes are dropped from memory after saving. Late joiners load the saved board, then receive live updates.
- **Teacher controls:** lock (students switch to view mode; server rejects their updates) and clear (all elements marked deleted and broadcast).
- **Live cursors:** participant pointers and names via Excalidraw's `collaborators`.
- Excalidraw is lazy-loaded the first time someone opens the whiteboard. The image tool is disabled (images need upload and storage; see `docs/improvements.md`).

### G. Text-to-speech
- In the meeting sidebar and at `/tools/tts`.
- Text area (5000-character limit), voice dropdown populated from `speechSynthesis.getVoices()` (loads asynchronously — listen for `voiceschanged`), rate and pitch sliders.
- **Voice selection where supported** (brief): the dropdown lists the voices the browser offers, grouped by language, with the system default marked and online voices labelled (`localService`). It preselects a voice matching the browser language and remembers the user's choice (`localStorage`). While voices are loading it says so; if the browser offers none, the dropdown is disabled with an explanation and the browser's default voice is used.
- Play, Pause, Resume, Stop; current-word highlighting where `boundary` events are supported.
- Text is split into sentences before speaking — Chrome cuts off long single utterances after ~15 s.
- Clear message if the browser has no speech synthesis support.
- The UI talks to a small **speech engine interface**; the browser's Web Speech API is the only engine for now, so a cloud voice provider could be added later without changing the UI ([ADR 009](adr/009-tts-browser-engine.md)).

---

## 8. Cross-cutting concerns

- **Validation:** Zod schemas in `packages/shared`, used by frontend forms, Fastify routes and socket handlers.
- **Errors:** one Fastify error handler maps validation/auth/not-found/domain errors to the standard error shape. Frontend shows toasts (Sonner) and uses error boundaries for crashes.
- **Security:** same-origin cookies, `@fastify/helmet`, rate limiting, Prisma parameterized queries, authorization on every socket event, server-only Sudoku solutions.
- **Logging:** pino (Fastify built-in), structured, per-request ids.
- **Configuration:** `.env.example` documents `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.

---

## 9. Assumptions filling gaps in the brief

| Gap | Decision |
|---|---|
| Score formula | Formula in §7D |
| Behaviour when time runs out | Game ends as `TIMED_OUT`; report generated |
| Counting wrong answers | One count, **mistakes**: every wrong value placed (as in the brief, which lists correct entries and mistakes). 5 mistakes ends the game as `FAILED`. Correct cells lock in, so each cell scores at most once |
| Which teachers see which reports | Teachers see all games of students who attended any of their meetings |
| Several games at once | At most one game in progress per student (a partial unique index); starting a new one ends the open one as `ABANDONED` |
| Changing an answer | Correct cells lock in (each cell scores once); wrong entries can be changed or cleared, and clearing is not a mistake |
| Role assignment | Teachers are seeded; self-registration creates students only |
| Whiteboards per meeting | One, persisted after the meeting ends |

---

## 10. Out of scope

Recording, password reset and email delivery, multiple whiteboards per meeting, mobile-first layouts, assigning Sudoku from inside a meeting. First stretch goal if time allows: **screen sharing** (supported by LiveKit).

---

## 11. Plan

| Day | Work |
|---|---|
| 1 | Monorepo, Docker Postgres, Prisma schema + seed, better-auth + roles, protected routes, role dashboards, shadcn setup, socket auth |
| 2 | Meeting API, LiveKit tokens, meeting room UI, participants (mute/remove/end), chat |
| 3 | Excalidraw integration, sync layer, persistence, lock/clear, cursors; multi-window testing |
| 4 | Sudoku generator/solver (tested), move API, server timer, game UI, reports + teacher table, TTS |
| 5 | Error-handling pass, README, OpenAPI, DB docs, deployment, demo rehearsal |

---

## 12. Deliverables ↔ brief

| # | Brief deliverable | Where |
|---|---|---|
| 1 | Working web application | Docker Compose locally + hosted URL |
| 2 | Student & teacher login | §7A; seeded accounts in README |
| 3 | Meeting & chat modules | §7B, §7C |
| 4 | Timed Sudoku | §7D |
| 5 | Automatic performance report | §7E |
| 6 | Collaborative whiteboard | §7F |
| 7 | Text-to-speech | §7G |
| 8 | Source code & Git repository | Small, meaningful commits |
| 9 | Database structure & API docs | `docs/database.md` + OpenAPI at `/api/docs` |
| 10 | README with setup | Setup, architecture, decisions, assumptions, known limitations |
