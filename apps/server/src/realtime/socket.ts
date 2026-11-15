import type { FastifyInstance } from 'fastify'
import { Server } from 'socket.io'
import type { Socket } from 'socket.io'
import type { ClientToServerEvents, PublicUser, ServerToClientEvents } from '@app/shared'
import { getUserFromHeaders } from '../auth/session'
import { env } from '../config/env'
import { userRoom } from './notifier'

const appOrigin = new URL(env.BETTER_AUTH_URL).origin

/** Per-connection data, set once during the handshake. */
export interface SocketData {
  user: PublicUser
}

// Event maps come from @app/shared, so the client and server agree on every event
// name and payload at compile time.
export type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>
export type IoSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>

/**
 * Attach Socket.IO to Fastify's HTTP server.
 */
export function createSocketServer(app: FastifyInstance): IoServer {
  const io: IoServer = new Server(app.server, {
    path: '/socket.io',
    cors: { origin: false }, // Same-origin in production; in development the Vite proxy forwards /socket.io
    allowRequest: (req, callback) => {
      const origin = req.headers.origin
      callback(null, origin === undefined || origin === appOrigin)
    },
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
    void socket.join(userRoom(user.id))
    app.log.debug({ userId: user.id, socketId: socket.id }, 'socket connected')

    socket.on('disconnect', reason => {
      app.log.debug({ userId: user.id, socketId: socket.id, reason }, 'socket disconnected')
    })
  })

  return io
}
