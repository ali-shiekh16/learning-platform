import { expect } from 'vitest'
import { io as connect, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@app/shared'
import type { TestUser } from './helpers'

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/**
 * Real Socket.IO clients for a server listening at `getUrl()`. Every socket opened is
 * tracked so `closeAll()` (in afterEach) never leaves connections behind.
 */
export function createSocketClients(getUrl: () => string) {
  const open: ClientSocket[] = []

  async function connectAs(user: TestUser): Promise<ClientSocket> {
    const socket: ClientSocket = connect(getUrl(), {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: { cookie: user.cookie },
    })
    open.push(socket)
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', resolve)
      socket.on('connect_error', reject)
    })
    return socket
  }

  /** Connect and enter the meeting's room, as the meeting page does. */
  async function enterMeeting(user: TestUser, meetingId: string) {
    const socket = await connectAs(user)
    const result = await socket.emitWithAck('meeting:join', { meetingId })
    expect(result).toEqual({ ok: true, data: null })
    return socket
  }

  return {
    connectAs,
    enterMeeting,
    closeAll: () => {
      for (const socket of open.splice(0)) socket.close()
    },
  }
}

/** Resolves with the next payload of `event`, or fails after `ms`. */
export function nextEvent<E extends keyof ServerToClientEvents>(
  socket: ClientSocket,
  event: E,
  ms = 2000,
) {
  return new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${event} within ${ms}ms`)), ms)
    socket.once(event, ((payload: Parameters<ServerToClientEvents[E]>[0]) => {
      clearTimeout(timer)
      resolve(payload)
    }) as never)
  })
}

/** Resolves true if `event` does NOT arrive within `ms`. */
export function noEvent(socket: ClientSocket, event: keyof ServerToClientEvents, ms = 300) {
  return nextEvent(socket, event, ms).then(
    () => false,
    () => true,
  )
}
