import type { FastifyBaseLogger } from 'fastify'
import { sendChatMessageSchema } from '@app/shared'
import { handleEvent } from '../../realtime/ack'
import { meetingRoom } from '../../realtime/notifier'
import type { IoSocket } from '../../realtime/socket'
import type { ChatService } from './chat.service'

/**
 * chat:send → validate → check participant + rate limit → save → broadcast.
 * The message is saved before it is broadcast, so history and live view never disagree,
 * and it carries the server's timestamp, not the sender's clock.
 */
export function registerChatSocketHandlers(
  socket: IoSocket,
  { chat, log }: { chat: ChatService; log: FastifyBaseLogger },
) {
  socket.on('chat:send', (payload, ack) =>
    handleEvent(log, {
      schema: sendChatMessageSchema,
      payload,
      ack,
      run: async input => {
        const message = await chat.send(socket.data.user, input)
        // The sender gets the message through the ack; everyone else via broadcast.
        socket.to(meetingRoom(input.meetingId)).emit('chat:message', message)
        return message
      },
    }),
  )
}
