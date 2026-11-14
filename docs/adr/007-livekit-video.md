# ADR 007 — LiveKit for audio/video

**Status:** Accepted

## Context
Meetings need multi-party audio/video with microphone and camera controls, participant state, and teacher moderation (mute, remove, end). Building reliable multi-party WebRTC (signalling, TURN, an SFU) is a project of its own.

## Decision
Use **LiveKit Cloud** (free Build plan) with `@livekit/components-react` on the client and `livekit-server-sdk` on the server.

## Reasons
- **Open source and self-hostable** — no vendor lock-in; the same code works against a self-hosted LiveKit server.
- **React components** provide the video grid and mic/camera controls; they can be composed into a custom layout.
- **Server SDK** covers everything moderation needs: access tokens with grants, `mutePublishedTrack`, `removeParticipant`, `deleteRoom`, `listParticipants`.
- **Free tier fits the demo:** ~5,000 participant-minutes/month and up to 100 concurrent participants, with a hard cap instead of overage charges (verify current figures on livekit.io/pricing).

## Token and moderation design
- `POST /api/meetings/:id/token` mints a token only for current, non-removed participants. Teacher grants: `roomAdmin`, `canPublish`, `canSubscribe`; student: `canPublish`, `canSubscribe`.
- `removeParticipant` disconnects a user but does not by itself stop them rejoining with a still-valid token. Removal is therefore enforced by: (1) LiveKit disconnect, (2) `removed = true` in our database so no new token is issued, (3) short token lifetimes (~5 min; tokens are only checked at connect), and (4) the client leaving on the `participant:removed` socket event.

## Alternatives considered
- **Raw WebRTC mesh with our own signalling.** Educational, but fragile beyond ~4 participants and needs TURN infrastructure; time is better spent elsewhere.
- **Jitsi (meet.jit.si embed).** Free public embeds are now time-limited; self-hosting is heavy.
- **Daily, Agora, Twilio.** Capable, but proprietary; LiveKit's open-source server keeps a self-hosting path open.

## Consequences
- Requires LiveKit Cloud credentials in `.env` (or a self-hosted LiveKit server for offline runs).
- Camera/mic access requires HTTPS outside `localhost`; the hosted deployment provides it.
