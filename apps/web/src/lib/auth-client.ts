import { createAuthClient } from 'better-auth/react'

/**
 * better-auth's browser client: sign-up, sign-in and sign-out calls to /api/auth/*.
 * No baseURL is needed because the API is served from the same origin as the app.
 *
 * Note: we do not use its session hook for the current user. The single source of
 * truth is our own /api/me endpoint (see useCurrentUser), which returns the role
 * already validated by the server.
 */
export const authClient = createAuthClient()
