import { useState } from 'react'
import { LogOut, Menu, Moon, Sun } from 'lucide-react'
import { NavLink } from 'react-router'
import type { PublicUser } from '@app/shared'
import { STATUS_LABEL } from '@/components/connection-status'
import { ROLE_LABEL, UserAvatar } from '@/components/user-menu'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useSocketStatus } from '@/hooks/use-socket'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'

/** Phones: a menu button that opens the navigation, account and theme in a side sheet. */
export function MobileNav({
  user,
  links,
  onSignOut,
  signingOut,
}: {
  user: PublicUser
  links: { to: string; label: string }[]
  onSignOut: () => void
  signingOut: boolean
}) {
  const theme = useTheme()
  const status = useSocketStatus()
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      {/* The variant prefix matches the sheet's own width class, so this one wins. */}
      <SheetContent side="right" className="data-[side=right]:w-72">
        <SheetHeader className="border-b">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex items-center gap-3">
            <UserAvatar user={user} />
            <div className="grid min-w-0 leading-tight">
              <span className="truncate font-bold">{user.name}</span>
              <span className="text-xs text-muted-foreground">
                {ROLE_LABEL[user.role]} · {STATUS_LABEL[status]}
              </span>
            </div>
          </div>
        </SheetHeader>

        <nav aria-label="Main" className="grid gap-1 px-2">
          {/* Not wrapped in SheetClose: its Slot would turn NavLink's className function into a string. */}
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'rounded-md border-l-4 border-transparent px-3 py-2.5 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
                  isActive && 'border-primary bg-secondary font-bold text-secondary-foreground',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <SheetFooter className="border-t">
          <Button variant="outline" onClick={theme.toggle}>
            {theme.dark ? <Sun /> : <Moon />}
            {theme.toggleLabel}
          </Button>
          <Button variant="outline" onClick={onSignOut} disabled={signingOut}>
            <LogOut /> Sign out
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
