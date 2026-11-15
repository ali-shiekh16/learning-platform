import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  chatHistoryQuerySchema,
  chatHistorySchema,
  createMeetingSchema,
  joinMeetingSchema,
  meetingIdParamsSchema,
  meetingListSchema,
  meetingSchema,
  meetingTokenSchema,
  participantParamsSchema,
} from '@app/shared'
import { currentUser, requireAuth, requireRole } from '../../auth/guards'
import type { ChatService } from '../chat/chat.service'
import type { MeetingsService } from './meetings.service'

/** HTTP layer only: validate input, check the role, call the service. */
export async function meetingRoutes(
  fastify: FastifyInstance,
  { meetings, chat }: { meetings: MeetingsService; chat: ChatService },
) {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const tags = ['meetings']

  app.get(
    '/api/meetings',
    {
      preHandler: requireAuth,
      schema: {
        tags,
        summary: 'Live meetings (teachers also see their own past ones)',
        response: { 200: meetingListSchema },
      },
    },
    async request => meetings.list(currentUser(request)),
  )

  app.post(
    '/api/meetings',
    {
      preHandler: requireRole('TEACHER'),
      schema: {
        tags,
        summary: 'Start a meeting',
        body: createMeetingSchema,
        response: { 201: meetingSchema },
      },
    },
    async (request, reply) =>
      reply.code(201).send(await meetings.create(currentUser(request), request.body)),
  )

  app.post(
    '/api/meetings/join',
    {
      preHandler: requireAuth,
      schema: {
        tags,
        summary: 'Join a meeting by its code',
        body: joinMeetingSchema,
        response: { 200: meetingSchema },
      },
    },
    async request => meetings.joinByCode(currentUser(request), request.body.code),
  )

  app.get(
    '/api/meetings/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags,
        summary: 'A meeting you belong to',
        params: meetingIdParamsSchema,
        response: { 200: meetingSchema },
      },
    },
    async request => meetings.get(currentUser(request), request.params.id),
  )

  app.post(
    '/api/meetings/:id/join',
    {
      preHandler: requireAuth,
      schema: {
        tags,
        summary: 'Join a live meeting',
        params: meetingIdParamsSchema,
        response: { 200: meetingSchema },
      },
    },
    async request => meetings.joinById(currentUser(request), request.params.id),
  )

  app.post(
    '/api/meetings/:id/token',
    {
      preHandler: requireAuth,
      schema: {
        tags,
        summary: 'LiveKit access token for the meeting room',
        params: meetingIdParamsSchema,
        response: { 200: meetingTokenSchema },
      },
    },
    async request => meetings.createToken(currentUser(request), request.params.id),
  )

  app.post(
    '/api/meetings/:id/end',
    {
      preHandler: requireRole('TEACHER'),
      schema: {
        tags,
        summary: 'End the meeting for everyone',
        params: meetingIdParamsSchema,
        response: { 200: meetingSchema },
      },
    },
    async request => meetings.end(currentUser(request), request.params.id),
  )

  app.post(
    '/api/meetings/:id/participants/:userId/mute',
    {
      preHandler: requireRole('TEACHER'),
      schema: {
        tags,
        summary: "Mute a participant's microphone",
        params: participantParamsSchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await meetings.muteParticipant(currentUser(request), request.params.id, request.params.userId)
      return reply.code(204).send(null)
    },
  )

  app.post(
    '/api/meetings/:id/participants/:userId/remove',
    {
      preHandler: requireRole('TEACHER'),
      schema: {
        tags,
        summary: 'Remove a participant from the meeting',
        params: participantParamsSchema,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      await meetings.removeParticipant(
        currentUser(request),
        request.params.id,
        request.params.userId,
      )
      return reply.code(204).send(null)
    },
  )

  app.get(
    '/api/meetings/:id/messages',
    {
      preHandler: requireAuth,
      schema: {
        tags,
        summary: 'Chat history, newest page first (use nextCursor for older messages)',
        params: meetingIdParamsSchema,
        querystring: chatHistoryQuerySchema,
        response: { 200: chatHistorySchema },
      },
    },
    async request => chat.history(currentUser(request), request.params.id, request.query),
  )
}
