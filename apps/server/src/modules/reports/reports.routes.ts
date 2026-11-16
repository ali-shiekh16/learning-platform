import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  gameIdParamsSchema,
  reportListQuerySchema,
  reportListSchema,
  reportSchema,
} from '@app/shared'
import { currentUser, requireAuth } from '../../auth/guards'
import type { ReportsService } from './reports.service'

export async function reportRoutes(
  fastify: FastifyInstance,
  { reports }: { reports: ReportsService },
) {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const tags = ['reports']

  app.get(
    '/api/reports',
    {
      preHandler: requireAuth,
      schema: {
        tags,
        summary:
          'Students: their own reports. Teachers: reports of students who attended their meetings',
        querystring: reportListQuerySchema,
        response: { 200: reportListSchema },
      },
    },
    async request => reports.list(currentUser(request), request.query),
  )

  app.get(
    '/api/reports/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags,
        summary: 'One report: the finished game with its final grid',
        params: gameIdParamsSchema,
        response: { 200: reportSchema },
      },
    },
    async request => reports.get(currentUser(request), request.params.id),
  )
}
