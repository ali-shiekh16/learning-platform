import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@app/shared'

/** Typed with the event maps shared with the server: wrong names or payloads don't compile. */
export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/** `connecting` also covers automatic reconnection after a dropped connection. */
export type SocketStatus = 'connecting' | 'connected' | 'offline'

interface SocketContextValue {
  socket: AppSocket | null
  status: SocketStatus
}

export const SocketContext = createContext<SocketContextValue>({ socket: null, status: 'offline' })

const RETRY_AFTER_REJECTION_MS = 5000

/**
 * Opens one Socket.IO connection for the signed-in user and shares it with the app.
 * Read it through hooks/use-socket.
 */
export function SocketProvider({
  userId,
  onUnauthenticated,
  children,
}: {
  userId: string | null
  /** The server refused the session (e.g. it expired): re-check who is signed in. */
  onUnauthenticated: () => void
  children: ReactNode
}) {
  // One socket per signed-in user; created lazily and connected in the effect below.
  const socket = useMemo<AppSocket | null>(
    () => (userId ? io({ path: '/socket.io', withCredentials: true, autoConnect: false }) : null),
    [userId],
  )
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!socket) return
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    // Network failures are retried by Socket.IO itself. A rejection by the server's
    // handshake check is final (socket.active is false), so we decide what to do.
    const onConnectError = (error: Error) => {
      if (socket.active) return
      if (error.message === 'UNAUTHENTICATED') onUnauthenticated()
      else retryTimer = setTimeout(() => socket.connect(), RETRY_AFTER_REJECTION_MS)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.connect()

    return () => {
      clearTimeout(retryTimer)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.close()
      setConnected(false)
    }
  }, [socket, onUnauthenticated])

  const status: SocketStatus = !socket ? 'offline' : connected ? 'connected' : 'connecting'

  return <SocketContext value={{ socket, status }}>{children}</SocketContext>
}
