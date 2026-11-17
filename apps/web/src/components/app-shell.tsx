import { Link, NavLink, Outlet, useMatch, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Brand } from '@/components/brand'
import { ConnectionWarning } from '@/components/connection-status'
import { MobileNav } from '@/components/mobile-nav'
import { UserMenu } from '@/components/user-menu'
import { useCurrentUser, useSignOut } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { to: '/meetings', label: 'Meetings' },
  { to: '/sudoku', label: 'Sudoku', studentsOnly: true },
  { to: '/reports', label: 'Reports' },
  { to: '/tools/tts', label: 'Text to speech' },
]

/** Header + page content for every signed-in page. */
export function AppShell() {
  const { user } = useCurrentUser()
  const signOut = useSignOut()
  const navigate = useNavigate()
  const inMeetingRoom = useMatch('/meetings/:id') !== null

  const handleSignOut = () =>
    signOut.mutate(undefined, {
      onSuccess: () => navigate('/sign-in', { replace: true }),
      onError: error => toast.error(error.message),
    })

  const links = NAV_LINKS.filter(link => !link.studentsOnly || user?.role === 'STUDENT')

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4">
          <Link to="/" className="shrink-0">
            <Brand />
          </Link>
          <nav aria-label="Main" className="hidden h-full items-stretch gap-1 md:flex">
            {links.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center border-b-2 border-transparent px-2 pt-0.5 text-sm font-medium text-muted-foreground hover:text-foreground',
                    isActive && 'border-primary text-foreground',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <ConnectionWarning />
            {user && (
              <>
                <div className="hidden md:block">
                  <UserMenu user={user} onSignOut={handleSignOut} />
                </div>
                <div className="md:hidden">
                  <MobileNav user={user} links={links} onSignOut={handleSignOut} />
                </div>
              </>
            )}
          </div>
        </div>
      </header>
      {/* The meeting room uses the whole window; other pages keep a readable width. */}
      <main className={cn('mx-auto p-4 sm:p-6', !inMeetingRoom && 'max-w-6xl sm:py-10')}>
        <Outlet />
      </main>
    </div>
  )
}
