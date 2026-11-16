import { useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SignInInput, SignUpInput } from '@app/shared'
import * as authService from '@/services/auth.service'
import { ApiError } from '@/services/http'
import { queryKeys } from './query-keys'

export function useCurrentUser() {
  const query = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: ({ signal }) => authService.getCurrentUser(signal),
    staleTime: 5 * 60 * 1000,
    // "Not signed in" is an answer (null), not an error. Only failures to reach the
    // server end up here, e.g. while it restarts: retry those a few times first.
    retry: (failures, error) =>
      failures < 3 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
  })
  return {
    user: query.data,
    isLoading: query.isPending,
    error: query.error,
    retry: () => void query.refetch(),
  }
}

/** Re-check who is signed in, e.g. after the server rejected the session. */
export function useRecheckCurrentUser() {
  const queryClient = useQueryClient()
  return useCallback(
    () => void queryClient.invalidateQueries({ queryKey: queryKeys.currentUser }),
    [queryClient],
  )
}

export function useSignIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SignInInput) => authService.signIn(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.currentUser }),
  })
}

export function useSignUp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SignUpInput) => authService.signUp(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.currentUser }),
  })
}

export function useSignOut() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: authService.signOut,
    onSuccess: () => queryClient.clear(),
  })
}
