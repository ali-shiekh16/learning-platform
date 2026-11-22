import { useEffect, useState } from 'react'
import { useSocketStatus } from '@/hooks/use-socket'
import type { SocketStatus } from '@/lib/socket'
import { cn } from '@/lib/utils'

export const STATUS_LABEL: Record<SocketStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  offline: 'Offline',
}

/** How long the connection may be down before the header says so. */
const WARNING_DELAY_MS = 3000

/** A coloured dot for the real-time connection: green, pulsing grey, or red. */
export function ConnectionDot({ className }: { className?: string }) {
  const status = useSocketStatus()
  return (
    <span
      aria-hidden
      className={cn(
        'size-2.5 rounded-full',
        status === 'connected' && 'bg-success',
        status === 'connecting' && 'animate-pulse bg-muted-foreground',
        status === 'offline' && 'bg-live',
        className,
      )}
    />
  )
}

/**
 * Only shown when something is wrong: while connected the avatar's dot is enough, but a
 * dropped connection should be visible without opening a menu. Every page load starts
 * by connecting, and short blips reconnect on their own, so it waits a few seconds first.
 */
export function ConnectionWarning() {
  const status = useSocketStatus()
  const [hasConnected, setHasConnected] = useState(false)
  const [visible, setVisible] = useState(false)

  // Back online: remember it, and hide the warning until the next long outage.
  if (status === 'connected' && (!hasConnected || visible)) {
    setHasConnected(true)
    setVisible(false)
  }

  useEffect(() => {
    if (status === 'connected') return
    const timer = setTimeout(() => setVisible(true), WARNING_DELAY_MS)
    return () => clearTimeout(timer)
  }, [status])

  if (!visible || status === 'connected') return null
  const label = status === 'connecting' && hasConnected ? 'Reconnecting…' : STATUS_LABEL[status]

  return (
    <span
      role="status"
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        status === 'offline' ? 'border-live/40 text-live' : 'text-muted-foreground',
      )}
    >
      <ConnectionDot className="size-2" />
      {label}
    </span>
  )
}
