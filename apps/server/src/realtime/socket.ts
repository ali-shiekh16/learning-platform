import type { FastifyInstance } from 'fastify'
import { Server } from 'socket.io'
import type { PublicUser } from '@app/shared'
import { getUserFromHeaders } from '../auth/session'

/** Per-connection data, set once during the handshake. */
export interface SocketData {
  user: PublicUser
}

export type IoServer = Server<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>

/**
 * Attach Socket.IO to Fastify's HTTP server.
 *
 * Authentication happens once, in the handshake middleware: the browser sends the
 * same session cookie it uses for REST calls, and we resolve it with the same
 * function (`getUserFromHeaders`). Connections without a valid session are refused,
 * so every event handler can rely on `socket.data.user` being present.
 *
 * Event handlers for chat, whiteboard and meeting control are added in later modules.
 */
export function createSocketServer(app: FastifyInstance): IoServer {
  const io: IoServer = new Server(app.server, {
    path: '/socket.io',
    // Same-origin in production; in development the Vite proxy forwards /socket.io
    cors: { origin: false },
  })

  io.use(async (socket, next) => {
    try {
      const user = await getUserFromHeaders(socket.handshake.headers)
      if (!user) return next(new Error('UNAUTHENTICATED'))
      socket.data.user = user
      next()
    } catch (err) {
      app.log.error({ err }, 'Socket authentication failed')
      next(new Error('INTERNAL_ERROR'))
    }
  })

  // On shutdown, drop socket connections first; Fastify then closes the HTTP server.
  app.addHook('preClose', async () => {
    io.disconnectSockets(true)
  })

  io.on('connection', socket => {
    const { user } = socket.data
    // A personal room lets the server reach every tab of one user,
    // e.g. to tell them they were removed from a meeting.
    void socket.join(`user:${user.id}`)
    app.log.debug({ userId: user.id, socketId: socket.id }, 'socket connected')

    socket.on('disconnect', reason => {
      app.log.debug({ userId: user.id, socketId: socket.id, reason }, 'socket disconnected')
    })
  })

  return io
}
