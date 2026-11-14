import type { IncomingHttpHeaders } from 'node:http'
import { fromNodeHeaders } from 'better-auth/node'
import { roleSchema, type PublicUser } from '@app/shared'
import { auth } from './auth'

/**
 * Resolve the signed-in user from request headers (the session cookie).
 * Used by both HTTP routes and the Socket.IO handshake, so the two transports
 * share exactly one definition of "who is this?".
 *
 * Returns null when there is no valid session.
 */
export async function getUserFromHeaders(headers: IncomingHttpHeaders): Promise<PublicUser | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(headers) })
  if (!session) return null

  const { id, name, email, role } = session.user
  return { id, name, email, role: roleSchema.parse(role) }
}
