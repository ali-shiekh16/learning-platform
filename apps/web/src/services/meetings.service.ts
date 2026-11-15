import {
  chatHistorySchema,
  meetingListSchema,
  meetingSchema,
  meetingTokenSchema,
  type ChatHistory,
  type CreateMeetingInput,
  type Meeting,
  type MeetingToken,
} from '@app/shared'
import { http } from './http'

const json = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })

export async function listMeetings(signal?: AbortSignal): Promise<Meeting[]> {
  return meetingListSchema.parse(await http('/api/meetings', { signal }))
}

export async function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
  return meetingSchema.parse(await http('/api/meetings', json(input)))
}

export async function joinMeetingByCode(code: string): Promise<Meeting> {
  return meetingSchema.parse(await http('/api/meetings/join', json({ code })))
}

export interface MeetingSession {
  meeting: Meeting
  livekit: MeetingToken
}

export async function enterMeeting(
  meetingId: string,
  signal?: AbortSignal,
): Promise<MeetingSession> {
  const meeting = meetingSchema.parse(
    await http(`/api/meetings/${meetingId}/join`, { method: 'POST', signal }),
  )
  const livekit = meetingTokenSchema.parse(
    await http(`/api/meetings/${meetingId}/token`, { method: 'POST', signal }),
  )
  return { meeting, livekit }
}

export async function endMeeting(meetingId: string): Promise<Meeting> {
  return meetingSchema.parse(await http(`/api/meetings/${meetingId}/end`, { method: 'POST' }))
}

export async function muteParticipant(meetingId: string, userId: string): Promise<void> {
  await http(`/api/meetings/${meetingId}/participants/${userId}/mute`, { method: 'POST' })
}

export async function removeParticipant(meetingId: string, userId: string): Promise<void> {
  await http(`/api/meetings/${meetingId}/participants/${userId}/remove`, { method: 'POST' })
}

export async function getChatHistory(
  meetingId: string,
  before: string | undefined,
  signal?: AbortSignal,
): Promise<ChatHistory> {
  const query = new URLSearchParams({ limit: '50', ...(before && { before }) })
  return chatHistorySchema.parse(
    await http(`/api/meetings/${meetingId}/messages?${query}`, { signal }),
  )
}
