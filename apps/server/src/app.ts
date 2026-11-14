import Fastify, { type FastifyServerOptions } from 'fastify'
import helmet from '@fastify/helmet'
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

/**
 * Build the Fastify application without starting it. Keeping construction separate
 * from `listen()` lets tests drive the app in-process with `app.inject()`.
 */
export async function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify(options).withTypeProvider<ZodTypeProvider>()

  // Zod schemas on routes do three jobs: validate input, type the handler, document the API.
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  await app.register(helmet, {
    // The SPA is served by Vite in development; a strict CSP is configured with the
    // production build (Module 6), once the LiveKit and Excalidraw origins are known.
    contentSecurityPolicy: false,
  })
  await app.register(errorHandler)

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

  app.get('/api/health', { schema: { hide: true } }, async () => ({ status: 'ok' }))
  await app.register(authRoutes)

  return app
}

export type App = Awaited<ReturnType<typeof buildApp>>
