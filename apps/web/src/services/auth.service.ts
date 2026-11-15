import { createAuthClient } from 'better-auth/react'
import { publicUserSchema, type PublicUser, type SignInInput, type SignUpInput } from '@app/shared'
import { ApiError, http } from './http'

// better-auth's browser client, used only inside this service. Same origin, so no baseURL.
const authClient = createAuthClient()

interface BetterAuthError {
  status: number
  code?: string | undefined
}

function toApiError(
  error: BetterAuthError,
  messages: { unauthenticated?: string; fallback: string },
) {
  if (error.status === 429)
    return new ApiError(429, 'RATE_LIMITED', 'Too many attempts. Wait a minute and try again.')

  if (error.code === 'USER_ALREADY_EXISTS' || error.status === 422)
    return new ApiError(error.status, 'CONFLICT', 'An account with this email already exists.')

  if (error.status === 401 && messages.unauthenticated)
    return new ApiError(401, 'UNAUTHENTICATED', messages.unauthenticated)

  return new ApiError(error.status, 'INTERNAL_ERROR', messages.fallback)
}

export async function getCurrentUser(signal?: AbortSignal): Promise<PublicUser | null> {
  try {
    return publicUserSchema.parse(await http('/api/me', { signal }))
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export async function signIn(input: SignInInput): Promise<void> {
  const { error } = await authClient.signIn.email(input)
  if (error) {
    throw toApiError(error, {
      unauthenticated: 'Incorrect email or password.',
      fallback: 'Could not sign in. Please try again.',
    })
  }
}

export async function signUp(input: SignUpInput): Promise<void> {
  const { error } = await authClient.signUp.email(input)
  if (error)
    throw toApiError(error, { fallback: 'Could not create the account. Please try again.' })
}

export async function signOut(): Promise<void> {
  const { error } = await authClient.signOut()
  if (error) throw toApiError(error, { fallback: 'Could not sign out. Please try again.' })
}
