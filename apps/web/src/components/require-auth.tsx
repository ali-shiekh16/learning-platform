import { Navigate, Outlet, useLocation } from 'react-router'
import type { Role } from '@app/shared'
import { FullPageMessage, FullPageSpinner } from '@/components/full-page'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/use-auth'

export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { user, isLoading, error, retry } = useCurrentUser()
  const location = useLocation()

  if (isLoading) return <FullPageSpinner />
  if (error) {
    return (
      <FullPageMessage
        title="Can’t reach the server"
        description="We could not load your account. Check your connection and try again."
        action={<Button onClick={retry}>Try again</Button>}
      />
    )
  }
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/sign-in?redirect=${redirect}`} replace />
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <FullPageMessage
        title="No access"
        description="Your account does not have access to this page."
      />
    )
  }
  return <Outlet />
}
