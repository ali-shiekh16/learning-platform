import { useQueryClient } from '@tanstack/react-query'
import { Link, Outlet, useNavigate } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { useSocket, type SocketStatus } from '@/lib/socket'

const STATUS_LABEL: Record<SocketStatus, string> = {
  connected: 'Live',
  connecting: 'Connecting…',
  offline: 'Offline',
}

/** Header + page content for every signed-in page. */
export function AppShell() {
  const { user } = useCurrentUser()
  const { status } = useSocket()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  async function signOut() {
    await authClient.signOut()
    // Drop every cached query so nothing from this account leaks into the next one.
    queryClient.clear()
    await navigate('/sign-in', { replace: true })
  }

  return (
    <div className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="font-semibold">
            Learning Platform
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <span
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              title="Real-time connection"
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  status === 'connected' && 'bg-emerald-500',
                  status === 'connecting' && 'animate-pulse bg-amber-500',
                  status === 'offline' && 'bg-muted-foreground',
                )}
              />
              {STATUS_LABEL[status]}
            </span>
            {user && (
              <>
                <span className="hidden text-sm sm:inline">{user.name}</span>
                <Badge variant={user.role === 'TEACHER' ? 'default' : 'secondary'}>
                  {user.role === 'TEACHER' ? 'Teacher' : 'Student'}
                </Badge>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  )
}
