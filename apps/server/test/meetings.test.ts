import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { JOIN_CODE_ALPHABET, type Meeting } from '@app/shared'
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

let app: App
let livekit: ReturnType<typeof createFakeLiveKit>
let teacher: TestUser
let otherTeacher: TestUser
let student: TestUser
let outsider: TestUser

beforeAll(async () => {
  livekit = createFakeLiveKit()
  app = await buildApp({}, { livekit: livekit.gateway })
  await app.ready()
  ;[teacher, otherTeacher, student, outsider] = await Promise.all([
    signUp(app, 'TEACHER'),
    signUp(app, 'TEACHER'),
    signUp(app),
    signUp(app),
  ])
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

let meeting: Meeting
beforeEach(async () => {
  meeting = await createMeeting(app, teacher)
})

describe('creating meetings', () => {
  it('lets a teacher start a meeting with a readable join code', () => {
    expect(meeting.status).toBe('LIVE')
    expect(meeting.teacher.id).toBe(teacher.id)
    expect(meeting.joinCode).toHaveLength(6)
    for (const char of meeting.joinCode) expect(JOIN_CODE_ALPHABET).toContain(char)
  })

  it('forbids students from starting meetings', async () => {
    const res = await request(app, student, 'POST', '/api/meetings', { title: 'My class' })
    expect(res.statusCode).toBe(403)
  })

  it('validates the title', async () => {
    const res = await request(app, teacher, 'POST', '/api/meetings', { title: 'x' })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('VALIDATION_ERROR')
  })
})

describe('joining', () => {
  it('joins by code, ignoring case and spaces', async () => {
    const res = await request(app, student, 'POST', '/api/meetings/join', {
      code: ` ${meeting.joinCode.toLowerCase()} `,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(meeting.id)
  })

  it('returns 404 for an unknown code', async () => {
    const res = await request(app, student, 'POST', '/api/meetings/join', { code: 'ZZZZZZ' })
    expect(res.statusCode).toBe(404)
  })

  it('only shows a meeting to people who joined it', async () => {
    expect((await request(app, outsider, 'GET', `/api/meetings/${meeting.id}`)).statusCode).toBe(
      403,
    )

    await joinMeeting(app, student, meeting.id)
    expect((await request(app, student, 'GET', `/api/meetings/${meeting.id}`)).statusCode).toBe(200)
  })

  it('issues a LiveKit token with the user role to participants only', async () => {
    expect(
      (await request(app, outsider, 'POST', `/api/meetings/${meeting.id}/token`)).statusCode,
    ).toBe(403)

    await joinMeeting(app, student, meeting.id)
    const res = await request(app, student, 'POST', `/api/meetings/${meeting.id}/token`)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      token: `fake-token-for-${student.id}`,
      serverUrl: 'wss://livekit.test',
    })
    expect(livekit.calls.tokens.at(-1)).toEqual({
      roomName: `meeting-${meeting.id}`,
      identity: student.id,
      role: 'STUDENT',
    })
  })
})

describe('ending meetings', () => {
  it('lets only the meeting’s own teacher end it', async () => {
    const res = await request(app, otherTeacher, 'POST', `/api/meetings/${meeting.id}/end`)
    expect(res.statusCode).toBe(403)
  })

  it('ends the meeting, closes the LiveKit room and blocks further access', async () => {
    await joinMeeting(app, student, meeting.id)

    const res = await request(app, teacher, 'POST', `/api/meetings/${meeting.id}/end`)
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('ENDED')
    expect(livekit.calls.deletedRooms).toContain(`meeting-${meeting.id}`)

    const token = await request(app, student, 'POST', `/api/meetings/${meeting.id}/token`)
    expect(token.statusCode).toBe(409)
    const join = await request(app, outsider, 'POST', '/api/meetings/join', {
      code: meeting.joinCode,
    })
    expect(join.statusCode).toBe(409)
  })

  it('hides ended meetings from students but not from their teacher', async () => {
    await request(app, teacher, 'POST', `/api/meetings/${meeting.id}/end`)

    const studentList = (await request(app, student, 'GET', '/api/meetings')).json<Meeting[]>()
    expect(studentList.map(m => m.id)).not.toContain(meeting.id)
    const teacherList = (await request(app, teacher, 'GET', '/api/meetings')).json<Meeting[]>()
    expect(teacherList.map(m => m.id)).toContain(meeting.id)
  })
})

describe('moderation', () => {
  const participantUrl = (action: 'mute' | 'remove', userId: string) =>
    `/api/meetings/${meeting.id}/participants/${userId}/${action}`

  it('removes a participant: LiveKit is told and they lose all access', async () => {
    await joinMeeting(app, student, meeting.id)

    const res = await request(app, teacher, 'POST', participantUrl('remove', student.id))
    expect(res.statusCode).toBe(204)
    expect(livekit.calls.removed).toContain(student.id)

    for (const url of [`/api/meetings/${meeting.id}/token`, `/api/meetings/${meeting.id}/join`])
      expect((await request(app, student, 'POST', url)).statusCode).toBe(403)
    const history = await request(app, student, 'GET', `/api/meetings/${meeting.id}/messages`)
    expect(history.statusCode).toBe(403)
  })

  it('does not let students or other teachers moderate', async () => {
    await joinMeeting(app, student, meeting.id)
    expect(
      (await request(app, student, 'POST', participantUrl('remove', teacher.id))).statusCode,
    ).toBe(403)
    expect(
      (await request(app, otherTeacher, 'POST', participantUrl('remove', student.id))).statusCode,
    ).toBe(403)
  })

  it('does not let the teacher remove themselves', async () => {
    const res = await request(app, teacher, 'POST', participantUrl('remove', teacher.id))
    expect(res.statusCode).toBe(409)
  })

  it('mutes a participant’s microphone, or explains why it cannot', async () => {
    const res = await request(app, teacher, 'POST', participantUrl('mute', student.id))
    expect(res.statusCode).toBe(204)
    expect(livekit.calls.muted).toContain(student.id)

    livekit.noMicrophone.add(outsider.id)
    expect(
      (await request(app, teacher, 'POST', participantUrl('mute', outsider.id))).statusCode,
    ).toBe(409)

    livekit.notConnected.add(otherTeacher.id)
    expect(
      (await request(app, teacher, 'POST', participantUrl('mute', otherTeacher.id))).statusCode,
    ).toBe(404)
  })
})
