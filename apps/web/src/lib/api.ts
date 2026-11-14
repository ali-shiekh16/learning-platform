import { apiErrorSchema, type ErrorCode } from '@app/shared'

/** A failed API call, carrying the server's error code so the UI can react to it. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * fetch() wrapper for our REST API.
 * - Sends and parses JSON.
 * - Always includes cookies (the session lives in an httpOnly cookie).
 * - Turns every non-2xx response into an ApiError using the standard error body.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined) headers.set('content-type', 'application/json')

  let response: Response
  try {
    response = await fetch(path, { ...init, headers, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'INTERNAL_ERROR', 'Cannot reach the server. Check your connection.')
  }

  if (response.status === 204) return undefined as T
  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body)
    if (parsed.success) {
      const { code, message, details } = parsed.data.error
      throw new ApiError(response.status, code, message, details)
    }
    throw new ApiError(response.status, 'INTERNAL_ERROR', `Request failed (${response.status})`)
  }
  return body as T
}
