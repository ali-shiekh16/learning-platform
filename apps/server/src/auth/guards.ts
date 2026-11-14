import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify'
import type { PublicUser, Role } from '@app/shared'
import { forbidden, unauthenticated } from '../lib/errors'
import { getUserFromHeaders } from './session'

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `requireAuth`. Only read it in routes that use the guard. */
    user: PublicUser | null
  }
}

/**
 * Route guard: rejects the request with 401 unless it carries a valid session,
 * and attaches the user to `request.user`.
 */
export const requireAuth: preHandlerAsyncHookHandler = async (request: FastifyRequest) => {
  const user = await getUserFromHeaders(request.headers)
  if (!user) throw unauthenticated()
  request.user = user
}

/**
 * Route guard: requires a session *and* one of the given roles (403 otherwise).
 * Usage: `{ preHandler: requireRole('TEACHER') }`
 */
export function requireRole(...roles: Role[]): preHandlerAsyncHookHandler {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    await requireAuth.call(this, request, reply)
    if (!roles.includes(request.user!.role)) throw forbidden()
  }
}

/** Read the user inside a guarded route. Throws if the route forgot its guard. */
export function currentUser(request: FastifyRequest): PublicUser {
  if (!request.user)
    throw new Error('currentUser() called on a route without requireAuth/requireRole')

  return request.user
}
