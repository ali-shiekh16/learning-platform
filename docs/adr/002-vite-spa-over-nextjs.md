# ADR 002 — Vite + React Router SPA instead of Next.js

**Status:** Accepted

## Context
The frontend must be React. Every screen sits behind a login, and almost every screen is interactive and browser-dependent: WebRTC video, WebSockets, a canvas whiteboard, a game timer, the Web Speech API.

## Decision
Build a **client-side single-page app with Vite and React Router**, served from the same origin as the API.

## Reasons
- **Server-side rendering buys nothing here.** There are no public pages to index and no SEO requirement; the content is per-user and live.
- **Browser-only APIs conflict with SSR.** `navigator.mediaDevices`, `speechSynthesis`, Excalidraw and Socket.IO all expect `window`. Under Next.js these need `"use client"` everywhere and `dynamic(..., { ssr: false })` wrappers, plus hydration-mismatch debugging.
- **A long-running server is needed regardless.** Serverless hosting (Next.js's natural target) cannot hold WebSocket connections, so Next.js would not remove the separate Node server — it would add a second runtime.
- **Routing is not the hard part.** React Router provides nested layouts, protected routes and params (`/meetings/:id`) with very little code.
- **Simplicity.** One clear API boundary; fast Vite dev server.

## Alternatives considered
- **Next.js (App Router).** Excellent for content and SEO-driven sites; would be the right choice for future public pages (e.g. a course catalogue), which could be added as a separate app.

## Consequences
- Caddy serves the built SPA in production, in front of the API (ADR 010); Vite proxies `/api` and the socket path in development, so cookies are always same-origin.
