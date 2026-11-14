import type { IncomingHttpHeaders } from 'node:http'
import { fromNodeHeaders } from 'better-auth/node'
import { roleSchema, type PublicUser } from '@app/shared'
import { auth } from './auth'

export async function getUserFromHeaders(headers: IncomingHttpHeaders): Promise<PublicUser | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(headers) })
  if (!session) return null

  const { id, name, email, role } = session.user
  return { id, name, email, role: roleSchema.parse(role) }
}
