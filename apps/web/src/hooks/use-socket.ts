import { useContext } from 'react'
import { SocketContext } from '@/lib/socket'

/** The shared real-time connection and its status. Feature hooks build on this. */
export const useSocket = () => useContext(SocketContext)

/** Just the connection status, for UI such as the header indicator. */
export const useSocketStatus = () => useContext(SocketContext).status
