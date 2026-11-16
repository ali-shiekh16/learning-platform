import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  gameIdParamsSchema,
  gameSchema,
  moveResultSchema,
  moveSchema,
  startGameSchema,
} from '@app/shared'
import { currentUser, requireRole } from '../../auth/guards'
import type { SudokuService } from './sudoku.service'

/** Only students play (spec §5). Responses never include the solution. */
export async function sudokuRoutes(
  fastify: FastifyInstance,
  { sudoku }: { sudoku: SudokuService },
) {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const tags = ['sudoku']
  const preHandler = requireRole('STUDENT')

  app.get(
    '/api/sudoku/games/current',
    {
      preHandler,
      schema: {
        tags,
        summary: 'Your game in progress, or null',
        response: { 200: gameSchema.nullable() },
      },
    },
    async request => sudoku.current(currentUser(request)),
  )

  app.post(
    '/api/sudoku/games',
    {
      preHandler,
      schema: {
        tags,
        summary: 'Start a game (ends any game still open). Returns the puzzle, never the solution',
        body: startGameSchema,
        response: { 201: gameSchema },
      },
    },
    async (request, reply) =>
      reply.code(201).send(await sudoku.start(currentUser(request), request.body.difficulty)),
  )

  app.get(
    '/api/sudoku/games/:id',
    {
      preHandler,
      schema: {
        tags,
        summary: 'Resume a game: board, mistakes and seconds left',
        params: gameIdParamsSchema,
        response: { 200: gameSchema },
      },
    },
    async request => sudoku.get(currentUser(request), request.params.id),
  )

  app.post(
    '/api/sudoku/games/:id/moves',
    {
      preHandler,
      schema: {
        tags,
        summary: 'Place a value (1–9) or clear a wrong entry (0); answered with correct or not',
        params: gameIdParamsSchema,
        body: moveSchema,
        response: { 200: moveResultSchema },
      },
    },
    async request => sudoku.move(currentUser(request), request.params.id, request.body),
  )

  app.post(
    '/api/sudoku/games/:id/finish',
    {
      preHandler,
      schema: {
        tags,
        summary: 'Stop playing (ABANDONED, or TIMED_OUT if the time had run out)',
        params: gameIdParamsSchema,
        response: { 200: gameSchema },
      },
    },
    async request => sudoku.finish(currentUser(request), request.params.id),
  )
}
