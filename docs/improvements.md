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

## From the Module 3 plan

6. **Images on the whiteboard** — the
   Excalidraw image tool is disabled because image files need their own upload, storage and
   sync (elements only reference a file id). Needs: an upload endpoint, file storage, and
   sending `files` alongside elements.

7. **View the whiteboard of a past meeting** — boards are saved after a meeting ends, but
   there is no UI to open them. Would need a read-only board view from "Past meetings"
   (the API can reuse `assertCanView`).

8. **Smaller freehand updates** — a pen stroke is one element whose point list grows while
   drawing, and the whole element is resent every ~75 ms. Long strokes can reach tens of KB
   per update; sending only the new points (or throttling harder while drawing) would fix it.

9. **Boards across several servers** — live boards are kept in one process's memory. With
   more than one API server, add the Socket.IO Redis adapter and give each board a single
   owner (or move board state to Redis). Same limit as the chat rate limiter.

10. **Whiteboard batches by size, not just count** — `use-whiteboard.ts` splits changes into
    batches of 1000 elements, but Socket.IO rejects messages over 1 MB (`maxHttpBufferSize`)
    and drops the connection. Freehand strokes are several KB each, so pasting a large
    sketch could exceed it, disconnect, and repeat after reconnecting. Split batches by
    serialized size (e.g. ≤500 KB) as well, and add a test.

11. **Drop a student's strokes refused by the lock** — if the teacher locks the board while
    a student's changes are in flight, the server refuses them (`FORBIDDEN`) but the browser
    keeps them as unconfirmed and retries on every later change. The student then sees shapes
    nobody else has. On `FORBIDDEN`, reload the board from the server (discarding local
    unsent changes).

12. **Send offline board changes after rejoining the room** — on reconnect, `useWhiteboard`
    sends unsaved changes straight away, but the socket may not be back in the meeting room
    yet (`useMeetingRoom` rejoins on `connect`). The server then refuses them; they stay
    unconfirmed and only go out with the user's next stroke. Retry the send after
    `meeting:join` succeeds (e.g. a short retry on "Join the meeting first").

## From the Module 4 plan

13. **Sudoku pencil notes** — small candidate numbers in a cell. A UI-only feature (notes
    never go to the server), deliberately left out of the first version.

14. **Natural cloud voices (e.g. Cartesia)** — a second engine behind the TTS engine
    interface (ADR 009): a server endpoint that holds the API key and streams audio, per-user
    quotas and rate limits (billed per character), a "Natural voices" group in the voice
    dropdown, and a fallback to browser voices when the service fails.

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
