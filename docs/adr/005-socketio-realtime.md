# ADR 005 — Socket.IO for real-time chat, whiteboard and meeting control

**Status:** Accepted

## Context
Chat, whiteboard synchronisation, live cursors and meeting control events (meeting ended, participant removed) must reach all participants of a meeting in real time, with authorization per meeting.

## Decision
Use **Socket.IO** running in the same Node process as the Fastify API. Each meeting maps to a Socket.IO room `meeting:<id>`.

## Reasons
- **Rooms map 1:1 to meetings**, making broadcast-to-meeting trivial.
- **Acknowledgements** confirm chat delivery to the sender.
- **Automatic reconnection** with fallback transports handles flaky networks; clients re-join their meeting room on reconnect.
- **Typed events.** Event names and payloads are defined once in `packages/shared` and type both server and client.
- **Same process, same session.** The handshake carries the session cookie, validated with the same better-auth lookup as REST routes.

## Alternatives considered
- **Raw `ws`.** Lighter, but rooms, acks, reconnection and heartbeats would have to be built by hand.
- **Hosted pub/sub (Pusher, Ably).** Removes server work, but moves a core evaluated skill (real-time communication) to a third party and adds an external dependency.
- **LiveKit data channels.** Possible for chat, but would couple chat and whiteboard to the media connection; persistence and authorization would still need our server.

## Consequences
- A single server instance is assumed. Horizontal scaling would require the Socket.IO Redis adapter and moving in-memory whiteboard state to Redis — documented as a known limitation.
