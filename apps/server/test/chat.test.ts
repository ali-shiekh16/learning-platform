import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { io as connect, type Socket } from 'socket.io-client'
import type { ChatHistory, ClientToServerEvents, Meeting, ServerToClientEvents } from '@app/shared'
import { buildApp, type App } from '../src/app'
import { prisma } from '../src/db/prisma'
import { CHAT_RATE_LIMIT } from '../src/modules/chat/chat.service'
import {
  createFakeLiveKit,
  createMeeting,
  joinMeeting,
  request,
  signUp,
  type TestUser,
} from './helpers'

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let app: App
let url: string
let teacher: TestUser
let student: TestUser
let otherStudent: TestUser
let meeting: Meeting
const openSockets: ClientSocket[] = []

beforeAll(async () => {
  app = await buildApp({}, { livekit: createFakeLiveKit().gateway })
  await app.listen({ port: 0, host: '127.0.0.1' })
  url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

beforeEach(async () => {
  // Fresh users each test, so the per-user chat rate limit never carries over.
  ;[teacher, student, otherStudent] = await Promise.all([
    signUp(app, 'TEACHER'),
    signUp(app),
    signUp(app),
  ])
  meeting = await createMeeting(app, teacher)
  await joinMeeting(app, student, meeting.id)
})

afterEach(() => {
  for (const socket of openSockets.splice(0)) socket.close()
})

async function connectAs(user: TestUser): Promise<ClientSocket> {
  const socket: ClientSocket = connect(url, {
    path: '/socket.io',
    transports: ['websocket'],
    reconnection: false,
    extraHeaders: { cookie: user.cookie },
  })
  openSockets.push(socket)
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', resolve)
    socket.on('connect_error', reject)
  })
  return socket
}

/** Connect and enter the meeting's room, as the meeting page does. */
async function enterMeeting(user: TestUser) {
  const socket = await connectAs(user)
  const result = await socket.emitWithAck('meeting:join', { meetingId: meeting.id })
  expect(result).toEqual({ ok: true, data: null })
  return socket
}

/** Resolves with the next payload of `event`, or fails after `ms`. */
function nextEvent<E extends keyof ServerToClientEvents>(
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
function noEvent(socket: ClientSocket, event: keyof ServerToClientEvents, ms = 300) {
  return nextEvent(socket, event, ms).then(
    () => false,
    () => true,
  )
}

describe('entering a meeting room', () => {
  it('refuses people who have not joined the meeting', async () => {
    const socket = await connectAs(otherStudent)
    const result = await socket.emitWithAck('meeting:join', { meetingId: meeting.id })
    expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })

  it('rejects malformed payloads', async () => {
    const socket = await connectAs(student)
    const result = await socket.emitWithAck('meeting:join', { meetingId: '' })
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
  })
})

describe('chat', () => {
  it('delivers a message to the room with the sender and a server timestamp', async () => {
    const teacherSocket = await enterMeeting(teacher)
    const studentSocket = await enterMeeting(student)
    const received = nextEvent(teacherSocket, 'chat:message')

    const before = Date.now()
    const result = await studentSocket.emitWithAck('chat:send', {
      meetingId: meeting.id,
      body: '  Hello class  ',
    })

    expect(result.ok).toBe(true)
    const message = await received
    expect(message).toMatchObject({
      meetingId: meeting.id,
      body: 'Hello class',
      sender: { id: student.id, role: 'STUDENT' },
    })
    expect(Date.parse(message.createdAt)).toBeGreaterThanOrEqual(before - 1000)
  })

  it('does not leak messages to other meetings', async () => {
    const otherMeeting = await createMeeting(app, teacher, 'Other class')
    await joinMeeting(app, otherStudent, otherMeeting.id)
    const outsiderSocket = await connectAs(otherStudent)
    await outsiderSocket.emitWithAck('meeting:join', { meetingId: otherMeeting.id })

    const studentSocket = await enterMeeting(student)
    const silent = noEvent(outsiderSocket, 'chat:message')
    await studentSocket.emitWithAck('chat:send', { meetingId: meeting.id, body: 'secret' })
    expect(await silent).toBe(true)
  })

  it('rejects empty messages', async () => {
    const socket = await enterMeeting(student)
    const result = await socket.emitWithAck('chat:send', { meetingId: meeting.id, body: '   ' })
    expect(result).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })
  })

  it('rate-limits a user who sends too fast', async () => {
    const socket = await enterMeeting(student)
    const { limit } = CHAT_RATE_LIMIT
    const results = []
    for (let i = 0; i <= limit; i++)
      results.push(await socket.emitWithAck('chat:send', { meetingId: meeting.id, body: `m${i}` }))

    expect(results.slice(0, limit).every(r => r.ok)).toBe(true)
    expect(results[limit]).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } })
  })

  it('keeps history, oldest first, with pages for older messages', async () => {
    const socket = await enterMeeting(student)
    for (const body of ['one', 'two', 'three'])
      await socket.emitWithAck('chat:send', { meetingId: meeting.id, body })

    const latest = await request(
      app,
      teacher,
      'GET',
      `/api/meetings/${meeting.id}/messages?limit=2`,
    )
    const page = latest.json<ChatHistory>()
    expect(page.messages.map(m => m.body)).toEqual(['two', 'three'])
    expect(page.nextCursor).not.toBeNull()

    const older = await request(
      app,
      teacher,
      'GET',
      `/api/meetings/${meeting.id}/messages?limit=2&before=${page.nextCursor}`,
    )
    expect(older.json<ChatHistory>()).toEqual({
      messages: [expect.objectContaining({ body: 'one' })],
      nextCursor: null,
    })
  })
})

describe('meeting events', () => {
  it('tells everyone in the room when the meeting ends', async () => {
    const studentSocket = await enterMeeting(student)
    const ended = nextEvent(studentSocket, 'meeting:ended')

    await request(app, teacher, 'POST', `/api/meetings/${meeting.id}/end`)
    expect(await ended).toEqual({ meetingId: meeting.id })
  })

  it('tells a removed student and cuts them off from the chat', async () => {
    const teacherSocket = await enterMeeting(teacher)
    const studentSocket = await enterMeeting(student)
    const removed = nextEvent(studentSocket, 'participant:removed')

    await request(
      app,
      teacher,
      'POST',
      `/api/meetings/${meeting.id}/participants/${student.id}/remove`,
    )
    expect(await removed).toEqual({ meetingId: meeting.id, userId: student.id })

    const silent = noEvent(studentSocket, 'chat:message')
    await teacherSocket.emitWithAck('chat:send', { meetingId: meeting.id, body: 'after removal' })
    expect(await silent).toBe(true)

    const attempt = await studentSocket.emitWithAck('chat:send', {
      meetingId: meeting.id,
      body: 'let me back',
    })
    expect(attempt).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })
})
