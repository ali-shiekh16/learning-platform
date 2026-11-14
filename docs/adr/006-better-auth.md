# ADR 006 — better-auth with database sessions

**Status:** Accepted

## Context
The app needs login, two roles (Student, Teacher), role-based permissions on both REST and WebSocket, and the ability to cut off a user (e.g. one removed from a meeting). Password hashing, session management and CSRF protection are security-sensitive and easy to get subtly wrong.

## Decision
Use **better-auth** (email/password, Prisma adapter) with **database-backed sessions** in an httpOnly cookie. Authorization — role guards, ownership checks, per-event socket checks — is application code.

## Reasons
- **Don't hand-roll authentication.** better-auth provides hashing, sessions, CSRF protection and sign-in rate limiting.
- **Database sessions over JWTs.** Sessions can be revoked immediately; a JWT stays valid until it expires unless a denylist is added. With a single server and a database already present, stateless tokens give no benefit.
- **TypeScript-first, framework-agnostic**, with a Prisma adapter and CLI that generates its tables into our schema.
- **Clear ownership boundary.** The library handles *authentication*; the business rules of *authorization* are ours and visible in the code.

## Role handling
- `role` is a better-auth additional user field with `input: false`, so a client cannot choose "TEACHER" at sign-up.
- `input: false` also blocks better-auth's own server API from setting the field, so the seed script creates teachers through sign-up and then sets the role with a direct Prisma update.
- `role` is stored as a string constrained by Zod/TypeScript rather than a Prisma enum, avoiding a known better-auth issue with enum fields.

## Alternatives considered
- **Hand-written JWT auth (bcrypt + jsonwebtoken).** Fully transparent but more security-critical code to own, and no revocation without extra work.
- **Auth.js, Lucia.** Auth.js is oriented around Next.js; Lucia is deprecated as a library.
- **Hosted auth (Clerk, Auth0).** Fast, but moves user data and a core evaluated area to a third party.

## Consequences
- User IDs are strings (cuid); application foreign keys follow.
- The SPA and API are served from the same origin to avoid cross-site cookie configuration.
