import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp, type App } from '../src/app'
import { prisma } from '../src/db/prisma'
import { ORIGIN, randomIp } from './helpers'

let app: App
let limitedApp: App

beforeAll(async () => {
  app = await buildApp()
  // A second instance with a tiny API limit, so the limit can be reached quickly.
  limitedApp = await buildApp({}, { apiRateLimit: 3 })
  await Promise.all([app.ready(), limitedApp.ready()])
})

afterAll(async () => {
  await Promise.all([app.close(), limitedApp.close()])
  await prisma.$disconnect()
})

function signInAttempt(ip: string, headers: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    remoteAddress: ip,
    headers: { origin: ORIGIN, ...headers },
    payload: { email: 'nobody@test.local', password: 'wrong-password' },
  })
}

describe('sign-in rate limit (better-auth)', () => {
  it('blocks an IP after 10 attempts without affecting other IPs', async () => {
    const attacker = randomIp()
    for (let i = 0; i < 10; i++) expect((await signInAttempt(attacker)).statusCode).toBe(401)

    expect((await signInAttempt(attacker)).statusCode).toBe(429)
    expect((await signInAttempt(randomIp())).statusCode).toBe(401)
  })

  it('ignores a client-supplied X-Forwarded-For header', async () => {
    const attacker = randomIp()
    for (let i = 0; i < 10; i++) await signInAttempt(attacker)

    // Pretending to be another address must not reset the counter.
    const spoofed = await signInAttempt(attacker, { 'x-forwarded-for': randomIp() })
    expect(spoofed.statusCode).toBe(429)
  })
})

describe('API rate limit', () => {
  it('returns RATE_LIMITED once an IP exceeds the limit', async () => {
    const ip = randomIp()
    for (let i = 0; i < 3; i++) {
      const res = await limitedApp.inject({ method: 'GET', url: '/api/me', remoteAddress: ip })
      expect(res.statusCode).toBe(401)
    }

    const blocked = await limitedApp.inject({ method: 'GET', url: '/api/me', remoteAddress: ip })
    expect(blocked.statusCode).toBe(429)
    expect(blocked.json().error.code).toBe('RATE_LIMITED')

    const otherIp = await limitedApp.inject({
      method: 'GET',
      url: '/api/me',
      remoteAddress: randomIp(),
    })
    expect(otherIp.statusCode).toBe(401)
  })

  it('does not limit the health check', async () => {
    const ip = randomIp()
    for (let i = 0; i < 5; i++) {
      const res = await limitedApp.inject({ method: 'GET', url: '/api/health', remoteAddress: ip })
      expect(res.statusCode).toBe(200)
    }
  })
})

describe('request decoration', () => {
  it('declares request.user up front', () => {
    expect(app.hasRequestDecorator('user')).toBe(true)
  })
})
