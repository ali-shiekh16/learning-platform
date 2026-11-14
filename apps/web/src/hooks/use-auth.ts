import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SignInInput, SignUpInput } from '@app/shared'
import * as authService from '@/services/auth.service'
import { queryKeys } from './query-keys'

export function useCurrentUser() {
  const query = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authService.getCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  return { user: query.data, isLoading: query.isPending, error: query.error }
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
