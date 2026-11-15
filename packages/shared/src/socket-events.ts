import type { ChatMessage, SendChatMessageInput } from './chat'
import type { ErrorCode } from './errors'

/**
 * Socket.IO acknowledgement: the server's reply to an event, delivered to the
 * callback the client passed with it. Same error shape as the REST API.
 */
export type AckResult<T = null> =
  { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } }

export type Ack<T = null> = (result: AckResult<T>) => void

export interface MeetingRef {
  meetingId: string
}

/** Events the browser sends to the server. */
export interface ClientToServerEvents {
  'meeting:join': (payload: MeetingRef, ack: Ack) => void
  'meeting:leave': (payload: MeetingRef) => void
  'chat:send': (payload: SendChatMessageInput, ack: Ack<ChatMessage>) => void
}

/** Events the server sends to browsers. */
export interface ServerToClientEvents {
  'chat:message': (message: ChatMessage) => void
  'meeting:ended': (payload: MeetingRef) => void
  'participant:removed': (payload: MeetingRef & { userId: string }) => void
}
