import type { FastifyInstance } from 'fastify'
import { fromNodeHeaders } from 'better-auth/node'
import { publicUserSchema } from '@app/shared'
import { auth } from './auth'
import { currentUser, requireAuth } from './guards'

/**
 * This plugin adapts Fastify's request/reply to that.
 */
export async function authRoutes(app: FastifyInstance) {
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    schema: { hide: true }, // better-auth's own endpoints; not part of our OpenAPI docs
    config: { rateLimit: false }, // better-auth applies its own, stricter limits
    async handler(request, reply) {
      const url = new URL(request.url, requestOrigin(request))
      const body =
        request.method === 'GET' || request.body === undefined
          ? undefined
          : JSON.stringify(request.body)

      const headers = fromNodeHeaders(request.headers)
      headers.set('x-forwarded-for', request.ip)

      const response = await auth.handler(
        new Request(url, { method: request.method, headers, body }),
      )

      reply.status(response.status)
      response.headers.forEach((value, key) => {
        // Set-Cookie must stay as separate headers; Headers.forEach would join them.
        if (key.toLowerCase() !== 'set-cookie') reply.header(key, value)
      })
      const cookies = response.headers.getSetCookie()
      if (cookies.length > 0) reply.header('set-cookie', cookies)

      return reply.send(response.body ? await response.text() : null)
    },
  })

  app.get(
    '/api/me',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['auth'],
        summary: 'The signed-in user',
        response: { 200: publicUserSchema },
      },
    },
    async request => currentUser(request),
  )
}

/** Origin of the incoming request, used to rebuild an absolute URL for better-auth. */
function requestOrigin(request: { protocol: string; host: string }): string {
  return `${request.protocol}://${request.host}`
}
