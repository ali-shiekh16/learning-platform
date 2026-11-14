# ADR 001 — TypeScript across the full stack (Node.js backend, PostgreSQL)

**Status:** Accepted

## Context
The brief prefers React + PHP but allows "another backend technology", and the team's stack is not yet fixed. The application is dominated by real-time features: chat, presence, whiteboard sync and live meeting control. Delivery window is 4–5 days, and the developer must be able to explain and own every part of the implementation.

## Decision
Use **TypeScript on both frontend and backend**: React in the browser, Node.js on the server, PostgreSQL (via Prisma) for storage. Shared Zod schemas and socket event types live in a `packages/shared` workspace.

## Reasons
- **Real-time is the core workload.** Node's event loop holds many concurrent WebSocket connections cheaply, and Socket.IO runs in the same process as the REST API.
- **One language, shared contracts.** The same Zod schema validates a form in the browser and the request on the server; socket events are typed on both ends. API and UI cannot silently drift apart.
- **Ownership.** JavaScript is the developer's strongest language, so time goes into design decisions rather than learning a language under deadline.
- **PostgreSQL** gives proper relational modelling (users, meetings, participants, games, moves) plus JSONB for whiteboard elements. Prisma provides typed queries and migrations that double as schema documentation.

## Alternatives considered
- **PHP / Laravel (preferred by the brief).** Traditional PHP is request/response, so real-time needs a separate WebSocket server (e.g. Laravel Reverb) anyway, and the developer is new to PHP. The chosen architecture — REST API + WebSocket server + hosted media server — maps directly onto Laravel + Reverb if the team standardises on it.
- **Python / FastAPI.** Viable and familiar, but splits the codebase across two languages, duplicates validation schemas, and lacks an equivalent to Socket.IO's rooms, acks and reconnection out of the box.
- **Java / Spring Boot.** Strong for large systems (STOMP over WebSocket), but the developer is still learning it; too risky for a 5-day delivery.
- **Firebase / Supabase.** Would make real-time trivial but hide the API, database design and authorization work the assessment evaluates.

## Consequences
- Single toolchain (npm workspaces, Vitest, TypeScript compiler) across the repository.
- The team gets a clear, conventional client/API/WebSocket split that is portable to another backend language later.
