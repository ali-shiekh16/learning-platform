import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { io as connect, type Socket } from 'socket.io-client'
import { buildApp, type App } from '../src/app'
import { prisma } from '../src/db/prisma'
import { ORIGIN, signUp } from './helpers'

let app: App
let url: string

beforeAll(async () => {
  app = await buildApp()
  await app.listen({ port: 0, host: '127.0.0.1' })
  url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

/** Resolve on connect, reject with the server's error message on refusal. */
function connectWith(cookie?: string, origin?: string): Promise<Socket> {
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders.cookie = cookie
  if (origin) extraHeaders.origin = origin

  return new Promise((resolve, reject) => {
    const socket = connect(url, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: false,
      extraHeaders,
    })
    socket.on('connect', () => resolve(socket))
    socket.on('connect_error', err => {
      socket.close()
      reject(err)
    })
  })
}

describe('socket authentication', () => {
  it('refuses a connection without a session', async () => {
    await expect(connectWith()).rejects.toThrow('UNAUTHENTICATED')
  })

  it('accepts a connection with a valid session cookie', async () => {
    const user = await signUp(app)
    const socket = await connectWith(user.cookie)

    expect(socket.connected).toBe(true)
    socket.close()
  })
})

describe('socket origin check', () => {
  it('refuses a handshake from another site, even with a valid session', async () => {
    const user = await signUp(app)
    await expect(connectWith(user.cookie, 'https://evil.example')).rejects.toThrow()
  })

  it('accepts a handshake from our own origin', async () => {
    const user = await signUp(app)
    const socket = await connectWith(user.cookie, ORIGIN)

    expect(socket.connected).toBe(true)
    socket.close()
  })
})
