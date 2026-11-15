# Improvements backlog

Small improvements found while reviewing the code. Deliberately deferred; to be revisited
before the final submission.

## From the Module 2 review

1. **Chat: cheaper duplicate check** — `appendMessage` in `apps/web/src/hooks/use-chat.ts`
   compares an incoming message against every loaded page. A duplicate can only ever be in
   the newest page (a live message arriving while the first history page loads), so checking
   only `newest.messages` is enough: at most ~50 comparisons, and simpler to read.

2. **Chat history: separate display order from the cursor** — in
   `apps/server/src/modules/chat/chat.service.ts`, `history()` reverses the page and then reads
   the cursor from index 0 of the reversed list, which reads as if the reverse exists to find
   the oldest message. Clearer:
   ```ts
   const page = rows.slice(0, query.limit)                 // newest → oldest
   messages: page.toReversed().map(toChatMessageDto),      // display order
   nextCursor: hasMore ? page.at(-1)!.id : null,           // oldest on this page
   ```

3. **Distinct room names** — the LiveKit room (`meeting-<id>`, `roomNameFor` in
   `integrations/livekit.ts`) and the Socket.IO room (`meeting:<id>`, `meetingRoom` in
   `realtime/notifier.ts`) differ only by `-` vs `:`. Rename the LiveKit one (e.g.
   `livekit-meeting-<id>`) so the two systems can't be confused.

## From the Module 1 review

4. **Explicit database pool settings** — `apps/server/src/db/prisma.ts` relies on
   node-postgres defaults (10 connections). Set `max`, connection and idle timeouts
   explicitly, with a comment, so the pooling is visible.

5. **`await socket.join(...)` instead of `void`** — in `realtime/socket.ts`, clearer and
   correct if the Redis adapter (where `join` returns a Promise) is ever used.

## Known limitations (document in the README rather than fix)

- Chat rate limiter is in memory: per process, reset on restart, and inactive users' entries
  are only pruned when they send again.
- Attendance `leftAt` may not be written for users connected when the server crashes.
- If a LiveKit admin call fails after our database change, the database wins (e.g. an ended
  meeting's LiveKit room lingers until LiveKit closes it as empty).

## Still to test manually

- Screen sharing between two browsers.
- Chat between two real browsers (verified so far with one browser and a scripted client).
