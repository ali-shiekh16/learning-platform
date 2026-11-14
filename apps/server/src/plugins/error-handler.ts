import type { FastifyError, FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import type { ApiErrorBody } from '@app/shared'
import { AppError } from '../lib/errors'

/**
 * One place that turns every failure into the standard error body
 * `{ error: { code, message, details? } }`
 */
export const errorHandler = fp(async (app: FastifyInstance) => {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send(
        body('VALIDATION_ERROR', 'The request is invalid', {
          issues: error.validation.map(v => ({
            path: v.instancePath || '/',
            message: v.message,
          })),
        }),
      )
    }

    if (error instanceof AppError)
      return reply.status(error.statusCode).send(body(error.code, error.message, error.details))

    if (error.statusCode === 429)
      return reply.status(429).send(body('RATE_LIMITED', 'Too many requests, slow down'))

    // Malformed JSON and similar client errors raised by Fastify itself
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500)
      return reply.status(error.statusCode).send(body('VALIDATION_ERROR', error.message))

    request.log.error({ err: error }, 'Unhandled error')
    return reply.status(500).send(body('INTERNAL_ERROR', 'Something went wrong on our side'))
  })

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send(body('NOT_FOUND', `Route ${request.method} ${request.url} not found`))
  })
})

function body(
  code: ApiErrorBody['error']['code'],
  message: string,
  details?: unknown,
): ApiErrorBody {
  return details === undefined
    ? { error: { code, message } }
    : { error: { code, message, details } }
}
