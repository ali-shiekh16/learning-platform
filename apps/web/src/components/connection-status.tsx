import { useSocketStatus } from '@/hooks/use-socket'
import type { SocketStatus } from '@/lib/socket'
import { cn } from '@/lib/utils'

export const STATUS_LABEL: Record<SocketStatus, string> = {
  connected: 'Connected',
  connecting: 'Reconnecting…',
  offline: 'Offline',
}

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
 * dropped connection should be visible without opening a menu.
 */
export function ConnectionWarning() {
  const status = useSocketStatus()
  if (status === 'connected') return null
  return (
    <span
      role="status"
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        status === 'offline' ? 'border-live/40 text-live' : 'text-muted-foreground',
      )}
    >
      <ConnectionDot className="size-2" />
      {STATUS_LABEL[status]}
    </span>
  )
}
