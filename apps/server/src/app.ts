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
import { errorHandler } from './plugins/error-handler'

export interface AppConfig {
  /** Requests per minute per client IP for the REST API (auth routes excluded). */
  apiRateLimit?: number
}

export async function buildApp(options: FastifyServerOptions = {}, config: AppConfig = {}) {
  const app = Fastify(options).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  // Declared up front so every request object has the same shape (set by the auth guards).
  app.decorateRequest('user', null)

  await app.register(helmet, {
    contentSecurityPolicy: false,
  })
  await app.register(errorHandler)

  // Generous per-IP limit that stops scripts, not people. Keyed by IP because it runs
  // before authentication; a classroom behind one school IP shares this budget.
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

  app.get('/api/health', { schema: { hide: true }, config: { rateLimit: false } }, async () => ({
    status: 'ok',
  }))
  await app.register(authRoutes)

  return app
}

export type App = Awaited<ReturnType<typeof buildApp>>
