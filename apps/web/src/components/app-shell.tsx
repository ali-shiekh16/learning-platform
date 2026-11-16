import { Link, NavLink, Outlet, useMatch, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCurrentUser, useSignOut } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { useSocketStatus } from '@/hooks/use-socket'
import type { SocketStatus } from '@/lib/socket'

const NAV_LINKS = [
  { to: '/meetings', label: 'Meetings' },
  { to: '/sudoku', label: 'Sudoku', studentsOnly: true },
  { to: '/reports', label: 'Reports' },
  { to: '/tools/tts', label: 'Text to speech' },
]

const STATUS_LABEL: Record<SocketStatus, string> = {
  connected: 'Live',
  connecting: 'Connecting…',
  offline: 'Offline',
}

/** Header + page content for every signed-in page. */
export function AppShell() {
  const { user } = useCurrentUser()
  const status = useSocketStatus()
  const signOut = useSignOut()
  const navigate = useNavigate()
  const inMeetingRoom = useMatch('/meetings/:id') !== null

  const handleSignOut = () =>
    signOut.mutate(undefined, {
      onSuccess: () => navigate('/sign-in', { replace: true }),
      onError: error => toast.error(error.message),
    })

  return (
    <div className="min-h-svh bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="font-semibold">
            Learning Platform
          </Link>
          <nav className="flex gap-1 text-sm">
            {NAV_LINKS.filter(link => !link.studentsOnly || user?.role === 'STUDENT').map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-2 py-1 text-muted-foreground hover:text-foreground',
                    isActive && 'bg-muted text-foreground',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

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
            <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={signOut.isPending}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      {/* The meeting room uses the whole window; other pages keep a readable width. */}
      <main className={cn('mx-auto p-4 sm:p-6', !inMeetingRoom && 'max-w-6xl')}>
        <Outlet />
      </main>
    </div>
  )
}
