import { randomUUID } from 'node:crypto'
import type { App } from '../src/app'
import { prisma } from '../src/db/prisma'
import type { Meeting, Role } from '@app/shared'
import type { LiveKitGateway } from '../src/integrations/livekit'

export const ORIGIN = 'http://localhost:3000'

export interface TestUser {
  id: string
  email: string
  cookie: string
}

/**
 * A random private IPv4 address. Rate limits are counted per IP, so giving each test
 * its own address keeps tests from sharing (and exhausting) one counter.
 */
export function randomIp(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1
  return `10.${octet()}.${octet()}.${octet()}`
}

/** Sign up a fresh user through the real auth endpoint and return its session cookie. */
export async function signUp(app: App, role: Role = 'STUDENT'): Promise<TestUser> {
  const email = `user-${randomUUID()}@test.local`
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    remoteAddress: randomIp(),
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

/**
 * Stand-in for LiveKit: records every call so tests can assert on them, and never
 * touches the network. `notConnected` / `noMicrophone` simulate those room states.
 */
export function createFakeLiveKit() {
  const calls = {
    tokens: [] as { roomName: string; identity: string; role: Role }[],
    muted: [] as string[],
    removed: [] as string[],
    deletedRooms: [] as string[],
  }
  const notConnected = new Set<string>()
  const noMicrophone = new Set<string>()

  const gateway: LiveKitGateway = {
    serverUrl: 'wss://livekit.test',
    async createToken({ roomName, identity, role }) {
      calls.tokens.push({ roomName, identity, role })
      return `fake-token-for-${identity}`
    },
    async muteMicrophone(_roomName, identity) {
      if (notConnected.has(identity)) throw Object.assign(new Error('not found'), { status: 404 })
      calls.muted.push(identity)
      return !noMicrophone.has(identity)
    },
    async removeParticipant(_roomName, identity) {
      calls.removed.push(identity)
    },
    async deleteRoom(roomName) {
      calls.deletedRooms.push(roomName)
    },
  }
  return { gateway, calls, notConnected, noMicrophone }
}

/** Authenticated JSON request helper for app.inject. */
export function request(
  app: App,
  user: TestUser | null,
  method: 'GET' | 'POST',
  url: string,
  payload?: object,
) {
  return app.inject({
    method,
    url,
    remoteAddress: randomIp(),
    headers: user ? { cookie: user.cookie } : {},
    ...(payload && { payload }),
  })
}

export async function createMeeting(app: App, teacher: TestUser, title = 'Algebra class') {
  const res = await request(app, teacher, 'POST', '/api/meetings', { title })
  if (res.statusCode !== 201)
    throw new Error(`create meeting failed: ${res.statusCode} ${res.body}`)
  return res.json<Meeting>()
}

export async function joinMeeting(app: App, user: TestUser, meetingId: string) {
  const res = await request(app, user, 'POST', `/api/meetings/${meetingId}/join`)
  if (res.statusCode !== 200) throw new Error(`join failed: ${res.statusCode} ${res.body}`)
}
