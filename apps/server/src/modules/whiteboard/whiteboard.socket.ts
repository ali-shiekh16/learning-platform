import type { FastifyBaseLogger } from 'fastify'
import {
  boardClearSchema,
  boardLockSchema,
  boardPointerSchema,
  boardUpdateSchema,
} from '@app/shared'
import { AppError, forbidden } from '../../lib/errors'
import type { SlidingWindowLimiter } from '../../lib/sliding-window-limiter'
import { handleEvent } from '../../realtime/ack'
import { meetingRoom } from '../../realtime/notifier'
import type { IoSocket } from '../../realtime/socket'
import type { WhiteboardService } from './whiteboard.service'

// Clients batch changes every ~75 ms
export const BOARD_RATE_LIMIT = { limit: 40, windowMs: 1000 }

/**
 * Board events are frequent, so instead of a database check per stroke they rely on
 * membership of the meeting's socket room only active participants are let in
 * (meeting:join), and removal or the meeting ending takes sockets out of it.
 */
export function registerWhiteboardSocketHandlers(
  socket: IoSocket,
  {
    whiteboard,
    limiter,
    log,
  }: {
    whiteboard: WhiteboardService
    limiter: SlidingWindowLimiter
    log: FastifyBaseLogger
  },
) {
  const { user } = socket.data
  const requireInRoom = (meetingId: string) => {
    if (!socket.rooms.has(meetingRoom(meetingId))) throw forbidden('Join the meeting first')
  }

  socket.on('board:update', (payload, ack) =>
    handleEvent(log, {
      schema: boardUpdateSchema,
      payload,
      ack,
      run: async ({ meetingId, elements }) => {
        requireInRoom(meetingId)
        if (!limiter.tryConsume(user.id))
          throw new AppError('RATE_LIMITED', 'Drawing too fast, slow down')

        const changed = await whiteboard.applyUpdate(user, meetingId, elements)
        if (changed.length > 0)
          socket.to(meetingRoom(meetingId)).emit('board:update', { meetingId, elements: changed })
        return null
      },
    }),
  )

  // Cursor positions: not saved, no reply, and "volatile" so they are dropped rather
  // than queued when a connection is slow
  socket.on('board:pointer', payload => {
    const parsed = boardPointerSchema.safeParse(payload)
    if (!parsed.success || !socket.rooms.has(meetingRoom(parsed.data.meetingId))) return
    const { meetingId, x, y } = parsed.data
    socket.volatile
      .to(meetingRoom(meetingId))
      .emit('board:pointer', { meetingId, userId: user.id, name: user.name, x, y })
  })

  socket.on('board:lock', (payload, ack) =>
    handleEvent(log, {
      schema: boardLockSchema,
      payload,
      ack,
      run: async ({ meetingId, locked }) => {
        await whiteboard.setLocked(user, meetingId, locked)
        socket.nsp.to(meetingRoom(meetingId)).emit('board:locked', { meetingId, locked })
        return null
      },
    }),
  )

  socket.on('board:clear', (payload, ack) =>
    handleEvent(log, {
      schema: boardClearSchema,
      payload,
      ack,
      run: async ({ meetingId }) => {
        const cleared = await whiteboard.clear(user, meetingId)
        // Everyone, the teacher included, applies the deletions.
        const room = meetingRoom(meetingId)
        if (cleared.length > 0)
          socket.nsp.to(room).emit('board:update', { meetingId, elements: cleared })
        return null
      },
    }),
  )
}
