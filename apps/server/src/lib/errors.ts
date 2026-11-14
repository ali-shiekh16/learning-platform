import type { ErrorCode } from '@app/shared'

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
}

/**
 * An expected, user-facing failure (wrong role, missing record, ...). Route code
 * throws these; the central error handler turns them into the standard error body.
 * Anything that is *not* an AppError is treated as a bug and reported as a 500.
 */
export class AppError extends Error {
  readonly statusCode: number

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
    this.statusCode = STATUS_BY_CODE[code]
  }
}

export const unauthenticated = (message = 'You need to sign in to do that') =>
  new AppError('UNAUTHENTICATED', message)

export const forbidden = (message = 'You do not have permission to do that') =>
  new AppError('FORBIDDEN', message)

export const notFound = (what = 'Resource') => new AppError('NOT_FOUND', `${what} not found`)
