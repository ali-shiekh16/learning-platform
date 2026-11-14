# ADR 004 — Fastify as the backend framework

**Status:** Accepted

## Context
The backend serves about 20 REST routes and a dozen socket events. The brief explicitly evaluates input validation, API documentation, error handling and maintainable code.

## Decision
Use **Fastify** with `fastify-type-provider-zod` and `@fastify/swagger`.

## Reasons
- **One schema, three outputs.** Each route's Zod schema provides (1) request validation with clean 400 errors, (2) inferred TypeScript types for `request.body`/`params`/`query`, and (3) the generated OpenAPI documentation at `/api/docs`.
- **Plugin encapsulation.** Each feature (auth, meetings, chat, whiteboard, sudoku, reports) is a plugin with its own routes and hooks — modular structure without a heavy framework.
- **Built in:** structured logging (pino) with request ids, async error propagation, a central error handler for a consistent error shape.
- Performance is better than Express, but irrelevant at this scale and not a deciding factor.

## Alternatives considered
- **Express 5.** A valid choice — Express 5 fixed async error handling and has a direct better-auth integration. Validation, types, docs and logging would be four separately wired libraries rather than one designed system.
- **NestJS.** Spring-Boot-style architecture (modules, DI, guards, gateways) that pays off for large teams. For ~20 routes in 5 days, the boilerplate and learning curve outweigh the benefit; better-auth integration is community-maintained only.

## Consequences
- better-auth is mounted on `/api/auth/*` through a small adapter that converts Fastify requests to Fetch API `Request`s.
- Socket.IO attaches to Fastify's underlying HTTP server.
