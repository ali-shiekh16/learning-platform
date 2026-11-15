import { z } from 'zod'
import { roleSchema } from './roles'

export const MEETING_STATUSES = ['LIVE', 'ENDED'] as const
export const meetingStatusSchema = z.enum(MEETING_STATUSES)
export type MeetingStatus = z.infer<typeof meetingStatusSchema>

// No 0/O or 1/I, so codes can be read out loud and typed without confusion.
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const JOIN_CODE_LENGTH = 6

export const createMeetingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(80, 'Title must be at most 80 characters'),
})
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>

export const joinMeetingSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .length(JOIN_CODE_LENGTH, `The code has ${JOIN_CODE_LENGTH} characters`),
})
export type JoinMeetingInput = z.infer<typeof joinMeetingSchema>

export const meetingIdParamsSchema = z.object({ id: z.string().min(1) })

export const meetingSchema = z.object({
  id: z.string(),
  title: z.string(),
  joinCode: z.string(),
  status: meetingStatusSchema,
  teacher: z.object({ id: z.string(), name: z.string() }),
  createdAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
})
export type Meeting = z.infer<typeof meetingSchema>

export const meetingListSchema = z.array(meetingSchema)

/** What the browser needs to connect to the meeting's LiveKit room. */
export const meetingTokenSchema = z.object({
  token: z.string(),
  serverUrl: z.string(),
})
export type MeetingToken = z.infer<typeof meetingTokenSchema>

export const participantParamsSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
})

/**
 * Attributes our server puts in every LiveKit token, so the UI can show who is who
 * (LiveKit's participant identity is our user id).
 */
export const participantAttributesSchema = z.object({ role: roleSchema })
