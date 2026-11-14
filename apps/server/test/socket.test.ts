import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { io as connect, type Socket } from 'socket.io-client'
import { buildApp, type App } from '../src/app'
import { prisma } from '../src/db/prisma'
import { createSocketServer } from '../src/realtime/socket'
import { signUp } from './helpers'

let app: App
let url: string

beforeAll(async () => {
  app = await buildApp()
  createSocketServer(app)
  await app.listen({ port: 0, host: '127.0.0.1' })
  url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

/** Resolve on connect, reject with the server's error message on refusal. */
function connectWith(cookie?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect(url, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: cookie ? { cookie } : {},
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
