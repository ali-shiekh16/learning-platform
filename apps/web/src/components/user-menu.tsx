import { ChevronDown, LogOut, Moon, Sun } from 'lucide-react'
import type { PublicUser } from '@app/shared'
import { ConnectionDot, STATUS_LABEL } from '@/components/connection-status'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSocketStatus } from '@/hooks/use-socket'
import { useTheme } from '@/hooks/use-theme'
import { initials } from '@/lib/utils'

export const ROLE_LABEL = { TEACHER: 'Teacher', STUDENT: 'Student' } as const

/** The user's initials, with the real-time connection shown as a dot on the corner. */
export function UserAvatar({ user }: { user: PublicUser }) {
  return (
    <span className="relative">
      <Avatar className="size-8">
        <AvatarFallback className="bg-secondary text-xs font-bold text-secondary-foreground">
          {initials(user.name)}
        </AvatarFallback>
      </Avatar>
      <ConnectionDot className="absolute -right-0.5 -bottom-0.5 ring-2 ring-card" />
    </span>
  )
}

/** Desktop: who is signed in, the theme switch and sign out, behind the avatar. */
export function UserMenu({ user, onSignOut }: { user: PublicUser; onSignOut: () => void }) {
  const { theme, setTheme } = useTheme()
  const status = useSocketStatus()
  const dark = theme === 'dark'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 px-2"
          aria-label={`${user.name}, account menu`}
        >
          <UserAvatar user={user} />
          <span className="text-sm font-medium">{user.name}</span>
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="grid gap-0.5 font-normal">
          <span className="font-bold text-foreground">{user.name}</span>
          <span className="truncate text-muted-foreground">{user.email}</span>
          <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {ROLE_LABEL[user.role]} · <ConnectionDot className="size-2" />
            {STATUS_LABEL[status]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setTheme(dark ? 'light' : 'dark')}>
          {dark ? <Sun /> : <Moon />}
          {dark ? 'Light theme' : 'Dark theme'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
