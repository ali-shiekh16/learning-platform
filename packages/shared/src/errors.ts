import { z } from 'zod'

/**
 * Every failed API request returns this shape.
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const

export const errorCodeSchema = z.enum(ERROR_CODES)
export type ErrorCode = z.infer<typeof errorCodeSchema>

export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof apiErrorSchema>
