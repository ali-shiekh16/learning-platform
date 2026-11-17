import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { meetingIdParamsSchema, whiteboardSchema } from '@app/shared'
import { currentUser, requireAuth } from '../../auth/guards'
import type { WhiteboardService } from './whiteboard.service'

export async function whiteboardRoutes(
  fastify: FastifyInstance,
  { whiteboard }: { whiteboard: WhiteboardService },
) {
  const app = fastify.withTypeProvider<ZodTypeProvider>()

  app.get(
    '/api/meetings/:id/whiteboard',
    {
      preValidation: requireAuth,
      schema: {
        tags: ['whiteboard'],
        summary: 'The meeting’s board: all elements (including deleted ones) and lock state',
        params: meetingIdParamsSchema,
        response: { 200: whiteboardSchema },
      },
    },
    async request => whiteboard.get(currentUser(request), request.params.id),
  )
}
