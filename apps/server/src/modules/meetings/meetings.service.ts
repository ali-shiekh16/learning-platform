import { randomInt } from 'node:crypto'
import type { FastifyBaseLogger } from 'fastify'
import {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  meetingStatusSchema,
  type CreateMeetingInput,
  type Meeting,
  type MeetingToken,
  type PublicUser,
} from '@app/shared'
import type { prisma as prismaClient } from '../../db/prisma'
import { roomNameFor, type LiveKitGateway } from '../../integrations/livekit'
import { conflict, forbidden, notFound } from '../../lib/errors'
import type { RealtimeNotifier } from '../../realtime/notifier'

interface Deps {
  prisma: typeof prismaClient
  livekit: LiveKitGateway
  notifier: RealtimeNotifier
  log: FastifyBaseLogger
}

const withTeacher = { teacher: { select: { id: true, name: true } } } as const

type MeetingRow = {
  id: string
  title: string
  joinCode: string
  status: string
  createdAt: Date
  endedAt: Date | null
  teacher: { id: string; name: string }
}

export function toMeetingDto(row: MeetingRow): Meeting {
  return {
    id: row.id,
    title: row.title,
    joinCode: row.joinCode,
    status: meetingStatusSchema.parse(row.status),
    teacher: row.teacher,
    createdAt: row.createdAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
  }
}

function generateJoinCode(): string {
  let code = ''
  for (let i = 0; i < JOIN_CODE_LENGTH; i++)
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)]
  return code
}

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'

const isLiveKitNotFound = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  (('status' in error && error.status === 404) || ('code' in error && error.code === 'not_found'))

export type MeetingsService = ReturnType<typeof createMeetingsService>

export function createMeetingsService({ prisma, livekit, notifier, log }: Deps) {
  async function findMeeting(meetingId: string) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: withTeacher,
    })
    if (!meeting) throw notFound('Meeting')
    return meeting
  }

  async function findOwnedMeeting(user: PublicUser, meetingId: string) {
    const meeting = await findMeeting(meetingId)
    if (meeting.teacherId !== user.id)
      throw forbidden('Only the teacher who started this meeting can do that')
    return meeting
  }

  /** The meeting, if the user may see it: its teacher, or a participant who was not removed. */
  async function assertCanView(userId: string, meetingId: string) {
    const meeting = await findMeeting(meetingId)
    if (meeting.teacherId === userId) return meeting

    const participant = await prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId } },
    })
    if (!participant) throw forbidden('Join this meeting first')
    if (participant.removed) throw forbidden('You were removed from this meeting')
    return meeting
  }

  /** Like assertCanView, and the meeting must still be live. Guards every live action. */
  async function assertActiveParticipant(userId: string, meetingId: string) {
    const meeting = await assertCanView(userId, meetingId)
    if (meeting.status !== 'LIVE') throw conflict('This meeting has ended')
    return meeting
  }

  async function join(user: PublicUser, meeting: Awaited<ReturnType<typeof findMeeting>>) {
    if (meeting.status !== 'LIVE') throw conflict('This meeting has ended')

    const existing = await prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId: meeting.id, userId: user.id } },
    })
    if (existing?.removed) throw forbidden('You were removed from this meeting')

    await prisma.meetingParticipant.upsert({
      where: { meetingId_userId: { meetingId: meeting.id, userId: user.id } },
      create: { meetingId: meeting.id, userId: user.id },
      update: { leftAt: null },
    })
    return toMeetingDto(meeting)
  }

  return {
    assertCanView,
    assertActiveParticipant,
    /** The meeting, if `user` is the teacher who started it (403 otherwise). */
    assertOwner: findOwnedMeeting,

    /** Everyone sees live meetings; teachers also see their own past ones. */
    async list(user: PublicUser): Promise<Meeting[]> {
      const rows = await prisma.meeting.findMany({
        where:
          user.role === 'TEACHER'
            ? { OR: [{ status: 'LIVE' }, { teacherId: user.id }] }
            : { status: 'LIVE' },
        include: withTeacher,
        orderBy: { createdAt: 'desc' },
      })
      return rows.map(toMeetingDto)
    },

    async create(user: PublicUser, input: CreateMeetingInput): Promise<Meeting> {
      // A random code can collide with an existing one; the unique index catches it.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const meeting = await prisma.meeting.create({
            data: {
              title: input.title,
              joinCode: generateJoinCode(),
              teacherId: user.id,
              participants: { create: { userId: user.id } },
            },
            include: withTeacher,
          })
          return toMeetingDto(meeting)
        } catch (error) {
          if (!isUniqueViolation(error)) throw error
        }
      }
      throw new Error('Could not generate a unique join code')
    },

    async get(user: PublicUser, meetingId: string): Promise<Meeting> {
      return toMeetingDto(await assertCanView(user.id, meetingId))
    },

    async joinById(user: PublicUser, meetingId: string): Promise<Meeting> {
      return join(user, await findMeeting(meetingId))
    },

    async joinByCode(user: PublicUser, code: string): Promise<Meeting> {
      const meeting = await prisma.meeting.findUnique({
        where: { joinCode: code },
        include: withTeacher,
      })
      if (!meeting) throw notFound('Meeting')
      return join(user, meeting)
    },

    async createToken(user: PublicUser, meetingId: string): Promise<MeetingToken> {
      const meeting = await assertActiveParticipant(user.id, meetingId)
      const token = await livekit.createToken({
        roomName: roomNameFor(meeting.id),
        identity: user.id,
        name: user.name,
        role: user.role,
      })
      return { token, serverUrl: livekit.serverUrl }
    },

    async end(user: PublicUser, meetingId: string): Promise<Meeting> {
      const meeting = await findOwnedMeeting(user, meetingId)
      if (meeting.status === 'ENDED') return toMeetingDto(meeting)

      const ended = await prisma.meeting.update({
        where: { id: meetingId },
        data: { status: 'ENDED', endedAt: new Date() },
        include: withTeacher,
      })
      // The meeting is already ended in our database, which is what tokens and chat
      // check; a LiveKit failure here should not undo that.
      await livekit
        .deleteRoom(roomNameFor(meetingId))
        .catch(
          error =>
            isLiveKitNotFound(error) ||
            log.warn({ err: error, meetingId }, 'LiveKit deleteRoom failed'),
        )
      notifier.meetingEnded(meetingId)
      return toMeetingDto(ended)
    },

    async muteParticipant(user: PublicUser, meetingId: string, targetUserId: string) {
      const meeting = await findOwnedMeeting(user, meetingId)
      if (meeting.status !== 'LIVE') throw conflict('This meeting has ended')

      let muted: boolean
      try {
        muted = await livekit.muteMicrophone(roomNameFor(meetingId), targetUserId)
      } catch (error) {
        if (isLiveKitNotFound(error)) throw notFound('Participant')
        throw error
      }
      if (!muted) throw conflict('This participant has no microphone on')
    },

    async removeParticipant(user: PublicUser, meetingId: string, targetUserId: string) {
      const meeting = await findOwnedMeeting(user, meetingId)
      if (meeting.status !== 'LIVE') throw conflict('This meeting has ended')
      if (targetUserId === user.id) throw conflict('You cannot remove yourself')

      // Recorded first: from here on the user gets no tokens and no chat access.
      await prisma.meetingParticipant.upsert({
        where: { meetingId_userId: { meetingId, userId: targetUserId } },
        create: { meetingId, userId: targetUserId, removed: true, leftAt: new Date() },
        update: { removed: true, leftAt: new Date() },
      })
      await livekit
        .removeParticipant(roomNameFor(meetingId), targetUserId)
        .catch(
          error =>
            isLiveKitNotFound(error) ||
            log.warn({ err: error, meetingId, targetUserId }, 'LiveKit removeParticipant failed'),
        )
      notifier.participantRemoved(meetingId, targetUserId)
    },

    /** Attendance: when a user's last connection leaves the meeting. */
    async markLeft(userId: string, meetingId: string) {
      await prisma.meetingParticipant.updateMany({
        where: { meetingId, userId, removed: false },
        data: { leftAt: new Date() },
      })
    },
  }
}
