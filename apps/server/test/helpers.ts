import { randomUUID } from 'node:crypto'
import type { App } from '../src/app'
import { prisma } from '../src/db/prisma'
import type { Role } from '@app/shared'

export const ORIGIN = 'http://localhost:3000'

export interface TestUser {
  id: string
  email: string
  cookie: string
}

/** Sign up a fresh user through the real auth endpoint and return its session cookie. */
export async function signUp(app: App, role: Role = 'STUDENT'): Promise<TestUser> {
  const email = `user-${randomUUID()}@test.local`
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { origin: ORIGIN },
    payload: { name: 'Test User', email, password: 'password123' },
  })
  if (res.statusCode !== 200) throw new Error(`sign-up failed: ${res.statusCode} ${res.body}`)

  const { user } = res.json<{ user: { id: string } }>()
  if (role !== 'STUDENT') await prisma.user.update({ where: { id: user.id }, data: { role } })

  return { id: user.id, email, cookie: sessionCookie(res.headers['set-cookie']) }
}

/** Turn Set-Cookie response headers into a Cookie request header. */
export function sessionCookie(setCookie: string | string[] | undefined): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  return list.map(c => c.split(';')[0]).join('; ')
}
