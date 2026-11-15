# Database

PostgreSQL 17, accessed through Prisma 7. The source of truth is
[`apps/server/prisma/schema.prisma`](../apps/server/prisma/schema.prisma); every change is a
migration in `apps/server/prisma/migrations/`. This document explains the structure and the
reasoning behind it. Tables are added module by module.

## Conventions

- **Table names** are plural snake_case (`users`, `sessions`) via `@@map`; Prisma models are singular PascalCase.
- **IDs** are strings: better-auth generates user/session IDs; our tables use `cuid()`.
- **Enumerations** (`role`, later meeting and game statuses) are `text` columns, narrowed by Zod schemas in `@app/shared`. better-auth has a known issue with Prisma enum fields, and plain strings keep migrations simple.
- **Timestamps** are `timestamp(3)` in UTC; `updatedAt` is maintained by Prisma.
- **Deletes cascade** from a user to their sessions, accounts, meetings, attendance and messages, and from a meeting to its attendance and messages.

## Diagram

```mermaid
erDiagram
  users ||--o{ sessions : "has"
  users ||--o{ accounts : "signs in with"
  users ||--o{ meetings : "teaches"
  users ||--o{ meeting_participants : "attends"
  meetings ||--o{ meeting_participants : "has"
  meetings ||--o{ chat_messages : "has"
  users ||--o{ chat_messages : "sends"

  users {
    text id PK
    text name
    text email UK
    boolean emailVerified
    text role "STUDENT | TEACHER"
    timestamp createdAt
    timestamp updatedAt
  }
  sessions {
    text id PK
    text token UK
    timestamp expiresAt
    text userId FK
    text ipAddress
    text userAgent
  }
  accounts {
    text id PK
    text providerId "credential = email/password"
    text accountId
    text userId FK
    text password "hash, never plain text"
  }
  verifications {
    text id PK
    text identifier
    text value
    timestamp expiresAt
  }
  meetings {
    text id PK
    text title
    text joinCode UK "6 chars"
    text status "LIVE | ENDED"
    text teacherId FK
    timestamp createdAt
    timestamp endedAt
  }
  meeting_participants {
    text id PK
    text meetingId FK
    text userId FK
    timestamp joinedAt
    timestamp leftAt
    boolean removed
  }
  chat_messages {
    text id PK
    text meetingId FK
    text userId FK
    text body "1-1000 chars"
    timestamp createdAt
  }
```

## Tables

### Authentication (Module 1)

These four tables are the schema better-auth expects ([ADR 006](adr/006-better-auth.md)).

| Table | Purpose |
|---|---|
| `users` | One row per person. `role` is added by us as a better-auth *additional field* with `input: false`, so clients can never set it. |
| `sessions` | One row per signed-in browser. The cookie holds the session token; deleting the row signs that browser out immediately. |
| `accounts` | Sign-in methods per user. For email/password, `providerId = 'credential'` and `password` holds the hash. Kept separate from `users` so other providers (e.g. Google) could be added without schema changes. |
| `verifications` | Short-lived tokens (email verification, password reset). Unused for now; required by better-auth. |

Indexes: unique `users.email`, unique `sessions.token`, and `userId` on `sessions` and `accounts` for the per-user lookups better-auth performs.

### Meetings and chat (Module 2)

| Table | Purpose |
|---|---|
| `meetings` | A live class started by a teacher. `joinCode` is 6 characters from an alphabet without look-alikes (no 0/O, 1/I); a unique index guarantees no two meetings share one, and creation retries on the rare collision. `status` moves from `LIVE` to `ENDED` once, with `endedAt` set. |
| `meeting_participants` | Attendance and access in one row per user per meeting (unique `(meetingId, userId)`). `joinedAt` is the first join; `leftAt` is set when the user's last connection leaves and cleared on rejoin. `removed = true` is how a teacher's removal is enforced: such users get no LiveKit token, cannot enter the socket room, read history or send chat. |
| `chat_messages` | Persisted chat. Saved before being broadcast, with the server's timestamp. |

Indexes: `meetings(status)` for the live-meetings list, `meetings(teacherId)` for a teacher's past meetings, `meeting_participants(userId)`, and `chat_messages(meetingId, createdAt)`, which serves the paged history query (newest first, cursor by message id).

**Not stored:** who is connected to the video call right now, and their microphone/camera state. LiveKit already tracks that in real time; copying it would create a second source of truth that could disagree.
