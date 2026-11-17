import type { FastifyReply, FastifyRequest, preValidationAsyncHookHandler } from 'fastify'
import type { PublicUser, Role } from '@app/shared'
import { forbidden, unauthenticated } from '../lib/errors'
import { getUserFromHeaders } from './session'

declare module 'fastify' {
  interface FastifyRequest {
    user: PublicUser | null
  }
}

/**
 * Route guard: rejects the request with 401 unless it carries a valid session.
 *
 * Used as a route's `preValidation` hook. That position matters:
 * - after `onRequest`, where the rate limiter runs, so unauthenticated requests are
 *   still counted (each one costs a session lookup);
 * - before body validation, so a stranger gets 401/403, not a 400 describing the body.
 */
export const requireAuth: preValidationAsyncHookHandler = async (request: FastifyRequest) => {
  const user = await getUserFromHeaders(request.headers)
  if (!user) throw unauthenticated()
  request.user = user
}

/**
 * Route guard: requires a session *and* one of the given roles (403 otherwise).
 */
export function requireRole(...roles: Role[]): preValidationAsyncHookHandler {
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
