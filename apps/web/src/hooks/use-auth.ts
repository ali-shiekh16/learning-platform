import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PublicUser } from '@app/shared'
import { api, ApiError } from '@/lib/api'

export const currentUserKey = ['current-user'] as const

/** Fetch the signed-in user, or null when nobody is signed in (401). */
async function fetchCurrentUser(): Promise<PublicUser | null> {
  try {
    return await api<PublicUser>('/api/me')
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

/**
 * The signed-in user, cached by TanStack Query and shared by every component.
 * `user` is undefined while loading, null when signed out.
 */
export function useCurrentUser() {
  const query = useQuery({
    queryKey: currentUserKey,
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  return { user: query.data, isLoading: query.isPending, error: query.error }
}

/** Re-read the current user, e.g. after signing in or out. */
export function useRefreshCurrentUser() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: currentUserKey })
}
