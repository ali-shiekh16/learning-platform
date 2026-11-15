import Fastify, { type FastifyServerOptions } from 'fastify'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { authRoutes } from './auth/auth.routes'
import { env } from './config/env'
import { prisma } from './db/prisma'
import { createLiveKitGateway, type LiveKitGateway } from './integrations/livekit'
import { createChatService } from './modules/chat/chat.service'
import { registerChatSocketHandlers } from './modules/chat/chat.socket'
import { meetingRoutes } from './modules/meetings/meetings.routes'
import { createMeetingsService } from './modules/meetings/meetings.service'
import { registerMeetingSocketHandlers } from './modules/meetings/meetings.socket'
import { errorHandler } from './plugins/error-handler'
import { createRealtimeNotifier } from './realtime/notifier'
import { createSocketServer } from './realtime/socket'

export interface AppConfig {
  /** Requests per minute per client IP for the REST API (auth routes excluded). */
  apiRateLimit?: number
  /** Replaces the real LiveKit client, e.g. with a fake in tests. */
  livekit?: LiveKitGateway
}

export async function buildApp(options: FastifyServerOptions = {}, config: AppConfig = {}) {
  const app = Fastify(options).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  app.decorateRequest('user', null)

  await app.register(helmet, {
    contentSecurityPolicy: false,
  })
  await app.register(errorHandler)

  await app.register(rateLimit, {
    max: config.apiRateLimit ?? 600,
    timeWindow: '1 minute',
  })

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Learning Platform API',
        version: '1.0.0',
        description: 'REST API. Authentication endpoints live under /api/auth (better-auth).',
      },
    },
    transform: jsonSchemaTransform,
  })
  await app.register(swaggerUi, { routePrefix: '/api/docs' })

  // Composition root: every dependency is created here and passed in explicitly.
  const io = createSocketServer(app)

  const livekit =
    config.livekit ??
    createLiveKitGateway({
      url: env.LIVEKIT_URL,
      apiKey: env.LIVEKIT_API_KEY,
      apiSecret: env.LIVEKIT_API_SECRET,
    })

  const meetings = createMeetingsService({
    prisma,
    livekit,
    notifier: createRealtimeNotifier(io),
    log: app.log,
  })
  const chat = createChatService({ prisma, meetings })

  io.on('connection', socket => {
    registerMeetingSocketHandlers(io, socket, { meetings, log: app.log })
    registerChatSocketHandlers(socket, { chat, log: app.log })
  })

  app.get('/api/health', { schema: { hide: true }, config: { rateLimit: false } }, async () => ({
    status: 'ok',
  }))
  await app.register(authRoutes)
  await app.register(meetingRoutes, { meetings, chat })

  return app
}

export type App = Awaited<ReturnType<typeof buildApp>>
