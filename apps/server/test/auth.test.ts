import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { buildApp, type App } from '../src/app'
import { requireRole } from '../src/auth/guards'
import { prisma } from '../src/db/prisma'
import { ORIGIN, sessionCookie, signUp } from './helpers'

let app: App

beforeAll(async () => {
  app = await buildApp()
  // Routes that exist only in tests, to exercise the guards and error handler.
  app.get('/test/teacher-only', { preHandler: requireRole('TEACHER') }, async () => ({ ok: true }))
  app.post(
    '/test/validated',
    { schema: { body: z.object({ title: z.string().min(3) }) } },
    async request => request.body,
  )
  await app.ready()
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

describe('authentication', () => {
  it('rejects /api/me without a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me' })

    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({
      error: { code: 'UNAUTHENTICATED', message: expect.any(String) },
    })
  })

  it('signs up as a student and returns the user from /api/me', async () => {
    const user = await signUp(app)

    const res = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { cookie: user.cookie },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      id: user.id,
      name: 'Test User',
      email: user.email,
      role: 'STUDENT',
    })
  })

  it('never lets a client choose the TEACHER role at sign-up', async () => {
    const email = `sneaky-${Date.now()}@test.local`
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { origin: ORIGIN },
      payload: { name: 'Sneaky', email, password: 'password123', role: 'TEACHER' },
    })

    // `role` is marked input: false, so better-auth ignores it and the account is a student.
    expect(res.statusCode).toBe(200)
    const created = await prisma.user.findUnique({ where: { email } })
    expect(created?.role).toBe('STUDENT')
  })

  it('signs in with the right password and rejects a wrong one', async () => {
    const user = await signUp(app)

    const wrong = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: ORIGIN },
      payload: { email: user.email, password: 'not-the-password' },
    })
    expect(wrong.statusCode).toBe(401)

    const right = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: ORIGIN },
      payload: { email: user.email, password: 'password123' },
    })
    expect(right.statusCode).toBe(200)
    const me = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { cookie: sessionCookie(right.headers['set-cookie']) },
    })
    expect(me.json()).toMatchObject({ id: user.id })
  })

  it('ends the session on sign-out', async () => {
    const user = await signUp(app)

    const out = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: { origin: ORIGIN, cookie: user.cookie },
    })
    expect(out.statusCode).toBe(200)

    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: user.cookie } })
    expect(me.statusCode).toBe(401)
  })
})

describe('role guard', () => {
  it('returns 401 without a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/test/teacher-only' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 403 for a student', async () => {
    const student = await signUp(app, 'STUDENT')
    const res = await app.inject({
      method: 'GET',
      url: '/test/teacher-only',
      headers: { cookie: student.cookie },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error.code).toBe('FORBIDDEN')
  })

  it('allows a teacher', async () => {
    const teacher = await signUp(app, 'TEACHER')
    const res = await app.inject({
      method: 'GET',
      url: '/test/teacher-only',
      headers: { cookie: teacher.cookie },
    })

    expect(res.statusCode).toBe(200)
  })
})

describe('error format', () => {
  it('reports validation errors with field details', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test/validated',
      payload: { title: 'x' },
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details.issues[0].path).toContain('title')
  })

  it('reports unknown routes as NOT_FOUND', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/does-not-exist' })

    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })
})
