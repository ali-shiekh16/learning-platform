import type { FastifyBaseLogger } from 'fastify'
import type { z } from 'zod'
import type { AckResult } from '@app/shared'
import { AppError } from '../lib/errors'

export async function handleEvent<Schema extends z.ZodType, Result>(
  log: FastifyBaseLogger,
  options: {
    schema: Schema
    payload: unknown
    ack?: unknown
    run: (input: z.infer<Schema>) => Promise<Result>
  },
): Promise<void> {
  const reply = (result: AckResult<Result>) => {
    if (typeof options.ack === 'function') options.ack(result)
  }

  const parsed = options.schema.safeParse(options.payload)
  if (!parsed.success) {
    reply({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Invalid data',
      },
    })
    return
  }

  try {
    reply({ ok: true, data: await options.run(parsed.data) })
  } catch (error) {
    if (error instanceof AppError) {
      reply({ ok: false, error: { code: error.code, message: error.message } })
      return
    }
    log.error({ err: error }, 'Socket event handler failed')
    reply({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side' },
    })
  }
}
