# ADR 009 — Text-to-speech with the browser's Web Speech API, behind an engine interface

**Status:** Accepted

## Context
The brief asks for text-to-speech and to "allow users to select available voice options where supported". Cloud TTS services (e.g. Cartesia) offer far better and more consistent voices than browsers do, so we compared the two.

## Decision
Use the browser's **Web Speech API** (`speechSynthesis`) now, but write the UI against a small **speech engine interface** (list voices; speak, pause, resume, stop; report the current word). The browser engine is the only implementation for now.

## Reasons
- **It matches the brief.** "Available voices where supported" describes the browser API, whose voices depend on the user's device.
- **No key, no cost, no third party.** Text never leaves the browser, which matters for students' content; nothing to secure, meter or pay for.
- **Works offline** and keeps working if any external service is down.
- **The interface keeps the door open.** The UI only knows the interface, the same pattern as the LiveKit gateway, so a cloud engine can be added without changing the components.

## Alternatives considered
- **Cartesia (or another cloud TTS).** Natural voices, identical on every device, and word timestamps for reliable highlighting. But: the API key must stay on the server (a proxy endpoint), every character is billed (so per-user quotas and rate limits are needed: the text box allows 5000 characters), text goes to a third party, the feature fails offline, and we would own streaming audio playback and pause/resume. Too much cost and risk for a feature the brief frames around the browser's own voices.

## Consequences
- Voice quality and choice vary by browser and device; the UI handles loading, empty and unsupported cases explicitly (spec §7G).
- Word highlighting depends on `boundary` events, which some voices don't send; the read-along then shows progress by sentence instead.
- Adding a cloud engine later means one new implementation plus a server endpoint with quotas, not a UI rewrite (tracked in `docs/improvements.md`).
