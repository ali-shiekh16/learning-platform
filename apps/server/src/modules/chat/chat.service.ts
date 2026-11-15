import { roleSchema, type ChatHistory, type ChatMessage, type PublicUser } from '@app/shared'
import type { prisma as prismaClient } from '../../db/prisma'
import { AppError } from '../../lib/errors'
import { createSlidingWindowLimiter } from '../../lib/sliding-window-limiter'
import type { MeetingsService } from '../meetings/meetings.service'

interface Deps {
  prisma: typeof prismaClient
  meetings: MeetingsService
}

const withSender = { user: { select: { id: true, name: true, role: true } } } as const

type MessageRow = {
  id: string
  meetingId: string
  body: string
  createdAt: Date
  user: { id: string; name: string; role: string }
}

function toChatMessageDto(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    meetingId: row.meetingId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    sender: { id: row.user.id, name: row.user.name, role: roleSchema.parse(row.user.role) },
  }
}

export type ChatService = ReturnType<typeof createChatService>

// 15 messages per 3 seconds per user
export const CHAT_RATE_LIMIT = { limit: 15, windowMs: 3000 }

export function createChatService({ prisma, meetings }: Deps) {
  const limiter = createSlidingWindowLimiter(CHAT_RATE_LIMIT)

  return {
    async history(
      user: PublicUser,
      meetingId: string,
      query: { before?: string | undefined; limit: number },
    ): Promise<ChatHistory> {
      await meetings.assertCanView(user.id, meetingId)

      // one extra row tells us whether an older page exists.
      const rows = await prisma.chatMessage.findMany({
        where: { meetingId },
        include: withSender,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        ...(query.before && { cursor: { id: query.before }, skip: 1 }),
      })

      const hasMore = rows.length > query.limit
      const oldestFirst = rows.slice(0, query.limit).reverse()
      return {
        messages: oldestFirst.map(toChatMessageDto),
        nextCursor: hasMore ? (oldestFirst[0]?.id ?? null) : null, // The oldest message on this page is where the previous page ends.
      }
    },

    async send(user: PublicUser, input: { meetingId: string; body: string }): Promise<ChatMessage> {
      await meetings.assertActiveParticipant(user.id, input.meetingId)
      if (!limiter.tryConsume(user.id))
        throw new AppError('RATE_LIMITED', 'You are sending messages too quickly')

      const row = await prisma.chatMessage.create({
        data: { meetingId: input.meetingId, userId: user.id, body: input.body },
        include: withSender,
      })
      return toChatMessageDto(row)
    },
  }
}
