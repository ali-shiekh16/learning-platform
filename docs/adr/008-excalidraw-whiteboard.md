# ADR 008 — Excalidraw with a custom real-time sync layer

**Status:** Accepted

## Context
The brief asks for a FigJam-like shared whiteboard: drawing, text, basic shapes, multiple participants, real-time sync, undo, clear and colour selection. Third-party libraries are explicitly allowed if functional and explained.

## Decision
Use the **Excalidraw** React component (`@excalidraw/excalidraw`, MIT) for editing, and build our own **sync, persistence and permission layer** over Socket.IO.

## Reasons
- Drawing, text, shapes, colours, undo/redo and clear come built in, with a polished FigJam-like feel — rebuilding an editor would not demonstrate anything new.
- The npm package has no collaboration backend; the sync layer — the part the brief evaluates — is ours.

## Sync design
- **Outbound:** on `onChange`, send only elements whose `version` increased since the last send, batched every ~75 ms.
- **Inbound:** merge by element id; higher `version` wins, `versionNonce` breaks ties. Every client applies the same rule, so all converge without server coordination.
- **Deletes** travel as `isDeleted: true` tombstones; dropping them would resurrect deleted shapes.
- **Undo isolation:** remote updates are applied via `updateScene` without being captured in local history, so Ctrl+Z only undoes the user's own actions.
- **Persistence:** server keeps a merged in-memory copy per board, flushes to Postgres (JSONB) every ~2 s while dirty and when the room empties; late joiners load the saved board.
- **Permissions:** teacher can lock (students switch to view mode; server rejects their updates) and clear (all elements tombstoned and broadcast).
- **Cursors:** pointer positions broadcast (throttled) and rendered via Excalidraw `collaborators`.

## Alternatives considered
- **Custom canvas (react-konva).** Full control and very explainable, but a day of work for a less capable editor.
- **tldraw.** Strong SDK with built-in sync, but recent versions require a licence key for production use.
- **Yjs CRDT.** Robust for heavy concurrent editing, but more machinery than needed; Excalidraw's per-element versioning is sufficient for a classroom board.

## Consequences
- Large bundle (>1 MB) — lazy-loaded when the whiteboard tab opens.
- Hand-drawn visual style.
- Concurrent edits to the *same* element resolve last-writer-wins at element granularity.
