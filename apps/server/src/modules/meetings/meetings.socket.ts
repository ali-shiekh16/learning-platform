import type { FastifyBaseLogger } from 'fastify'
import { z } from 'zod'
import { handleEvent } from '../../realtime/ack'
import { meetingRoom } from '../../realtime/notifier'
import type { IoServer, IoSocket } from '../../realtime/socket'
import type { MeetingsService } from './meetings.service'

const meetingRefSchema = z.object({ meetingId: z.string().min(1) })

/**
 * Entering and leaving a meeting's socket room. Only sockets in the room receive its
 * chat and events, and only active participants are let in.
 */
export function registerMeetingSocketHandlers(
  io: IoServer,
  socket: IoSocket,
  { meetings, log }: { meetings: MeetingsService; log: FastifyBaseLogger },
) {
  const { user } = socket.data

  socket.on('meeting:join', (payload, ack) =>
    handleEvent(log, {
      schema: meetingRefSchema,
      payload,
      ack,
      run: async ({ meetingId }) => {
        await meetings.assertActiveParticipant(user.id, meetingId)
        await socket.join(meetingRoom(meetingId))
        return null
      },
    }),
  )

  socket.on('meeting:leave', payload =>
    handleEvent(log, {
      schema: meetingRefSchema,
      payload,
      run: async ({ meetingId }) => {
        await socket.leave(meetingRoom(meetingId))
        await recordLeaveIfLastConnection(meetingId)
      },
    }),
  )

  // 'disconnecting' fires while socket.rooms is still populated.
  socket.on('disconnecting', () => {
    const meetingIds = [...socket.rooms]
      .filter(room => room.startsWith('meeting:'))
      .map(room => room.slice('meeting:'.length))
    for (const meetingId of meetingIds) {
      void recordLeaveIfLastConnection(meetingId, socket.id).catch(err =>
        log.error({ err, meetingId }, 'Failed to record leaving a meeting'),
      )
    }
  })

  /** A user may have several tabs open; they have left only when none remains. */
  async function recordLeaveIfLastConnection(meetingId: string, excludeSocketId?: string) {
    const sockets = await io.in(meetingRoom(meetingId)).fetchSockets()
    const stillHere = sockets.some(s => s.data.user.id === user.id && s.id !== excludeSocketId)
    if (!stillHere) await meetings.markLeft(user.id, meetingId)
  }
}
