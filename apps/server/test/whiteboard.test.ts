import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  isNewerElement,
  MAX_ELEMENTS_PER_BOARD,
  MAX_ELEMENTS_PER_UPDATE,
  type BoardElement,
  type Meeting,
  type Whiteboard,
} from '@app/shared'
import { buildApp, type App } from '../src/app'
import { prisma } from '../src/db/prisma'
import {
  createFakeLiveKit,
  createMeeting,
  joinMeeting,
  request,
  signUp,
  type TestUser,
} from './helpers'
import { createSocketClients, nextEvent, noEvent } from './socket-helpers'

/** A minimal Excalidraw-like element. */
const element = (id: string, version = 1, versionNonce = 100, extra = {}): BoardElement => ({
  id,
  type: 'rectangle',
  version,
  versionNonce,
  isDeleted: false,
  x: 0,
  y: 0,
  ...extra,
})

describe('merge rule', () => {
  it('keeps the higher version', () => {
    expect(isNewerElement(element('a', 2), element('a', 1))).toBe(true)
    expect(isNewerElement(element('a', 1), element('a', 2))).toBe(false)
  })

  it('breaks version ties with the lower versionNonce, the same way everywhere', () => {
    expect(isNewerElement(element('a', 3, 5), element('a', 3, 9))).toBe(true)
    expect(isNewerElement(element('a', 3, 9), element('a', 3, 5))).toBe(false)
  })

  it('accepts anything for an element it has never seen', () => {
    expect(isNewerElement(element('a'), undefined)).toBe(true)
  })
})

let app: App
let url: string
const sockets = createSocketClients(() => url)

beforeAll(async () => {
  app = await buildApp({}, { livekit: createFakeLiveKit().gateway })
  await app.listen({ port: 0, host: '127.0.0.1' })
  url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

afterEach(() => sockets.closeAll())

let teacher: TestUser
let student: TestUser
let meeting: Meeting
beforeEach(async () => {
  // Fresh users per test so the per-user drawing rate limit never carries over.
  ;[teacher, student] = await Promise.all([signUp(app, 'TEACHER'), signUp(app)])
  meeting = await createMeeting(app, teacher)
  await joinMeeting(app, student, meeting.id)
})

const boardUrl = () => `/api/meetings/${meeting.id}/whiteboard`
const enter = (user: TestUser) => sockets.enterMeeting(user, meeting.id)

describe('loading the board', () => {
  it('starts empty and locked', async () => {
    const res = await request(app, student, 'GET', boardUrl())
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ elements: [], locked: true })
  })

  it('is private to the meeting', async () => {
    const outsider = await signUp(app)
    expect((await request(app, outsider, 'GET', boardUrl())).statusCode).toBe(403)
  })
})

describe('drawing', () => {
  it('rejects students while the board is locked, but lets the teacher draw', async () => {
    const teacherSocket = await enter(teacher)
    const studentSocket = await enter(student)

    const denied = await studentSocket.emitWithAck('board:update', {
      meetingId: meeting.id,
      elements: [element('s1')],
    })
    expect(denied).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })

    const received = nextEvent(studentSocket, 'board:update')
    const drawn = await teacherSocket.emitWithAck('board:update', {
      meetingId: meeting.id,
      elements: [element('t1')],
    })
    expect(drawn).toEqual({ ok: true, data: null })
    expect((await received).elements.map(e => e.id)).toEqual(['t1'])
  })

  it('lets students draw once unlocked, and tells everyone about the lock change', async () => {
    const teacherSocket = await enter(teacher)
    const studentSocket = await enter(student)

    const lockEvent = nextEvent(studentSocket, 'board:locked')
    await teacherSocket.emitWithAck('board:lock', { meetingId: meeting.id, locked: false })
    expect(await lockEvent).toEqual({ meetingId: meeting.id, locked: false })

    const received = nextEvent(teacherSocket, 'board:update')
    const result = await studentSocket.emitWithAck('board:update', {
      meetingId: meeting.id,
      elements: [element('s1', 1, 1, { x: 42 })],
    })
    expect(result.ok).toBe(true)
    expect((await received).elements[0]).toMatchObject({ id: 's1', x: 42 })
  })

  it('keeps unknown element fields and ignores stale copies', async () => {
    const teacherSocket = await enter(teacher)
    const studentSocket = await enter(student)
    await teacherSocket.emitWithAck('board:update', {
      meetingId: meeting.id,
      elements: [element('t1', 5, 1, { strokeColor: '#e03131' })],
    })

    // An older version is not stored and not forwarded.
    const silent = noEvent(studentSocket, 'board:update')
    await teacherSocket.emitWithAck('board:update', {
      meetingId: meeting.id,
      elements: [element('t1', 4, 1)],
    })
    expect(await silent).toBe(true)

    const board = (await request(app, student, 'GET', boardUrl())).json<Whiteboard>()
    expect(board.elements).toEqual([
      expect.objectContaining({ id: 't1', version: 5, strokeColor: '#e03131' }),
    ])
  })

  it('refuses images (not supported yet) and sockets that never joined the room', async () => {
    const teacherSocket = await enter(teacher)
    const image = await teacherSocket.emitWithAck('board:update', {
      meetingId: meeting.id,
      elements: [element('img', 1, 1, { type: 'image' })],
    })
    expect(image).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } })

    const notInRoom = await sockets.connectAs(student)
    const result = await notInRoom.emitWithAck('board:update', {
      meetingId: meeting.id,
      elements: [element('x')],
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })

  it('stops a removed student from drawing', async () => {
    const teacherSocket = await enter(teacher)
    const studentSocket = await enter(student)
    await teacherSocket.emitWithAck('board:lock', { meetingId: meeting.id, locked: false })

    await request(
      app,
      teacher,
      'POST',
      `/api/meetings/${meeting.id}/participants/${student.id}/remove`,
    )
    const result = await studentSocket.emitWithAck('board:update', {
      meetingId: meeting.id,
      elements: [element('s1')],
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })
})

describe('board size limit', () => {
  it('rejects an update that would overfill the board, without applying any of it', async () => {
    const teacherSocket = await enter(teacher)
    const batches = MAX_ELEMENTS_PER_BOARD / MAX_ELEMENTS_PER_UPDATE
    for (let batch = 0; batch < batches; batch++) {
      const elements = Array.from({ length: MAX_ELEMENTS_PER_UPDATE }, (_, i) =>
        element(`fill-${batch}-${i}`),
      )
      const result = await teacherSocket.emitWithAck('board:update', {
        meetingId: meeting.id,
        elements,
      })
      expect(result.ok).toBe(true)
    }

    // One edit plus one new shape: the new shape doesn't fit, so the edit must not apply either.
    const studentSocket = await enter(student)
    const silent = noEvent(studentSocket, 'board:update')
    const overfull = await teacherSocket.emitWithAck('board:update', {
      meetingId: meeting.id,
      elements: [element('fill-0-0', 2), element('one-too-many')],
    })
    expect(overfull).toMatchObject({ ok: false, error: { code: 'CONFLICT' } })
    expect(await silent).toBe(true)

    const board = (await request(app, teacher, 'GET', boardUrl())).json<Whiteboard>()
    expect(board.elements).toHaveLength(MAX_ELEMENTS_PER_BOARD)
    expect(board.elements.find(e => e.id === 'fill-0-0')?.version).toBe(1)

    // Editing existing shapes still works on a full board.
    const edit = await teacherSocket.emitWithAck('board:update', {
      meetingId: meeting.id,
      elements: [element('fill-0-0', 2)],
    })
    expect(edit.ok).toBe(true)
  })
})

describe('teacher controls', () => {
  it('only lets the meeting’s teacher lock or clear', async () => {
    const studentSocket = await enter(student)
    const lock = await studentSocket.emitWithAck('board:lock', {
      meetingId: meeting.id,
      locked: false,
    })
    const clear = await studentSocket.emitWithAck('board:clear', { meetingId: meeting.id })
    expect(lock).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    expect(clear).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
  })

  it('clears by sending everyone deletions that win over the old shapes', async () => {
    const teacherSocket = await enter(teacher)
    const studentSocket = await enter(student)
    await teacherSocket.emitWithAck('board:update', {
      meetingId: meeting.id,
      elements: [element('t1', 3), element('t2', 1)],
    })

    const studentSees = nextEvent(studentSocket, 'board:update')
    const teacherSees = nextEvent(teacherSocket, 'board:update')
    await teacherSocket.emitWithAck('board:clear', { meetingId: meeting.id })

    for (const update of [await studentSees, await teacherSees]) {
      expect(update.elements).toHaveLength(2)
      expect(update.elements.every(e => e.isDeleted)).toBe(true)
    }
    const t1 = (await studentSees).elements.find(e => e.id === 't1')!
    expect(t1.version).toBe(4)
  })
})

describe('saving', () => {
  it('saves the board so it survives a server restart', async () => {
    const teacherSocket = await enter(teacher)
    await teacherSocket.emitWithAck('board:update', {
      meetingId: meeting.id,
      elements: [element('kept', 2)],
    })
    await teacherSocket.emitWithAck('board:lock', { meetingId: meeting.id, locked: false })

    // A second app instance shares the database but not the first one's memory.
    const restarted = await buildApp({}, { livekit: createFakeLiveKit().gateway })
    await app.close() // closing saves unsaved boards
    try {
      const board = (await request(restarted, student, 'GET', boardUrl())).json<Whiteboard>()
      expect(board.locked).toBe(false)
      expect(board.elements).toEqual([expect.objectContaining({ id: 'kept', version: 2 })])
    } finally {
      await restarted.close()
      app = await buildApp({}, { livekit: createFakeLiveKit().gateway })
      await app.listen({ port: 0, host: '127.0.0.1' })
      url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
    }
  })
})
