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
 * fetch() wrapper for our REST API. Only services call it.
 */
export async function http(path: string, init: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined) headers.set('content-type', 'application/json')

  let response: Response
  try {
    response = await fetch(path, { ...init, headers, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'INTERNAL_ERROR', 'Cannot reach the server. Check your connection.')
  }

  if (response.status === 204) return undefined
  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body)
    if (parsed.success) {
      const { code, message, details } = parsed.data.error
      throw new ApiError(response.status, code, message, details)
    }
    throw new ApiError(response.status, 'INTERNAL_ERROR', `Request failed (${response.status})`)
  }
  return body
}
