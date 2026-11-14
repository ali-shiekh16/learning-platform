import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'

/** `connecting` also covers automatic reconnection after a dropped connection. */
export type SocketStatus = 'connecting' | 'connected' | 'offline'

interface SocketContextValue {
  socket: Socket | null
  status: SocketStatus
}

const SocketContext = createContext<SocketContextValue>({ socket: null, status: 'offline' })

/**
 * Opens one Socket.IO connection for the signed-in user and shares it with the app.
 *
 * The connection authenticates with the session cookie (same origin, sent
 * automatically), so it only exists while `userId` is set and is closed on sign-out.
 * Socket.IO reconnects by itself after network drops.
 */
export function SocketProvider({
  userId,
  children,
}: {
  userId: string | null
  children: ReactNode
}) {
  // One socket per signed-in user; created lazily and connected in the effect below.
  const socket = useMemo(
    () => (userId ? io({ path: '/socket.io', withCredentials: true, autoConnect: false }) : null),
    [userId],
  )
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!socket) return
    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.connect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.close()
      setConnected(false)
    }
  }, [socket])

  const status: SocketStatus = !socket ? 'offline' : connected ? 'connected' : 'connecting'

  return <SocketContext value={{ socket, status }}>{children}</SocketContext>
}

export const useSocket = () => useContext(SocketContext)
