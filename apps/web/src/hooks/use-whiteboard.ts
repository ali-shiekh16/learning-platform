import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CaptureUpdateAction, reconcileElements } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI, Collaborator, SocketId } from '@excalidraw/excalidraw/types'
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile'
import { MAX_ELEMENTS_PER_UPDATE, type BoardElement } from '@app/shared'
import { ApiError } from '@/services/http'
import * as whiteboardService from '@/services/whiteboard.service'
import { queryKeys } from './query-keys'
import { useSocket } from './use-socket'

const SEND_EVERY_MS = 75 // batch strokes instead of sending every mouse move
const POINTER_EVERY_MS = 50
const CURSOR_TIMEOUT_MS = 5000 // hide a cursor that stopped moving (user left, tab hidden)

const CURSOR_COLORS = ['#e03131', '#2f9e44', '#1971c2', '#f08c00', '#9c36b5', '#0c8599']
const colorFor = (userId: string) => {
  const hash = [...userId].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const color = CURSOR_COLORS[hash % CURSOR_COLORS.length]!
  return { background: color, stroke: color }
}

const asBoardElements = (elements: readonly OrderedExcalidrawElement[]) =>
  elements as unknown as BoardElement[]

/**
 * Keeps the local Excalidraw scene in sync with everyone else in the meeting.
 */
export function useWhiteboard(meetingId: string, isTeacher: boolean) {
  const { socket } = useSocket()
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const [lockedByEvent, setLockedByEvent] = useState<boolean | null>(null)

  const board = useQuery({
    queryKey: queryKeys.whiteboard(meetingId),
    queryFn: ({ signal }) => whiteboardService.getWhiteboard(meetingId, signal),
    staleTime: Infinity, // kept current over the socket
    gcTime: 0,
    retry: false,
  })

  // Version of each element the server has confirmed; anything else still needs sending.
  const confirmed = useRef(new Map<string, number>())
  useEffect(() => {
    for (const element of board.data?.elements ?? [])
      confirmed.current.set(element.id, element.version)
  }, [board.data])

  // Sending local changes
  const sending = useRef(false)
  const sendAgain = useRef(false)
  const sendTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Always the latest send function (it closes over api/socket), callable from timers.
  const sendChangesRef = useRef<() => Promise<void>>(async () => {})

  /** At most one send per batching window; also Excalidraw's onChange handler. */
  const scheduleSend = useCallback(() => {
    if (sendTimer.current) return
    sendTimer.current = setTimeout(() => {
      sendTimer.current = undefined
      void sendChangesRef.current()
    }, SEND_EVERY_MS)
  }, [])

  useEffect(() => {
    sendChangesRef.current = async () => {
      if (!api || !socket?.connected) return
      if (sending.current) {
        sendAgain.current = true
        return
      }
      const changed = api
        .getSceneElementsIncludingDeleted()
        .filter(element => confirmed.current.get(element.id) !== element.version)
      if (changed.length === 0) return

      sending.current = true
      try {
        for (let i = 0; i < changed.length; i += MAX_ELEMENTS_PER_UPDATE) {
          const batch = changed.slice(i, i + MAX_ELEMENTS_PER_UPDATE)
          const result = await socket
            .timeout(5000)
            .emitWithAck('board:update', { meetingId, elements: asBoardElements(batch) })
          // Unconfirmed elements stay "changed" and are retried with the next send.
          if (result.ok)
            for (const element of batch) confirmed.current.set(element.id, element.version)
          else if (result.error.code === 'RATE_LIMITED') sendAgain.current = true
        }
      } catch {
        // Timeout: retried on the next change or reconnect.
      } finally {
        sending.current = false
        if (sendAgain.current) {
          sendAgain.current = false
          scheduleSend()
        }
      }
    }
  }, [api, socket, meetingId, scheduleSend])

  useEffect(() => () => clearTimeout(sendTimer.current), [])

  // Receiving other people's changes, cursors and lock changes
  const collaborators = useRef(new Map<SocketId, Collaborator & { lastSeen: number }>())

  useEffect(() => {
    if (!socket || !api) return

    const applyRemote = (elements: BoardElement[]) => {
      // Mark as confirmed so these are not echoed straight back to the server.
      for (const element of elements) confirmed.current.set(element.id, element.version)
      const merged = reconcileElements(
        api.getSceneElementsIncludingDeleted(),
        elements as unknown as RemoteExcalidrawElement[],
        api.getAppState(),
      )
      api.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER })
    }

    const onUpdate = (payload: { meetingId: string; elements: BoardElement[] }) => {
      if (payload.meetingId === meetingId) applyRemote(payload.elements)
    }

    const onPointer = (payload: {
      meetingId: string
      userId: string
      name: string
      x: number
      y: number
    }) => {
      if (payload.meetingId !== meetingId) return
      collaborators.current.set(payload.userId as SocketId, {
        id: payload.userId,
        username: payload.name,
        pointer: { x: payload.x, y: payload.y, tool: 'pointer' },
        color: colorFor(payload.userId),
        lastSeen: Date.now(),
      })
      api.updateScene({ collaborators: new Map(collaborators.current) })
    }

    const onLocked = (payload: { meetingId: string; locked: boolean }) => {
      if (payload.meetingId === meetingId) setLockedByEvent(payload.locked)
    }

    // Changes made while disconnected: fetch the server's board, merge it in, and send
    // anything of ours the server hasn't confirmed.
    const onReconnect = () =>
      void whiteboardService
        .getWhiteboard(meetingId)
        .then(saved => {
          applyRemote(saved.elements)
          setLockedByEvent(saved.locked)
          return sendChangesRef.current()
        })
        .catch(() => {})

    const pruneCursors = setInterval(() => {
      const cutoff = Date.now() - CURSOR_TIMEOUT_MS
      let changed = false
      for (const [id, collaborator] of collaborators.current)
        if (collaborator.lastSeen < cutoff) changed = collaborators.current.delete(id) || changed
      if (changed) api.updateScene({ collaborators: new Map(collaborators.current) })
    }, 1000)

    socket.on('board:update', onUpdate)
    socket.on('board:pointer', onPointer)
    socket.on('board:locked', onLocked)
    socket.io.on('reconnect', onReconnect)
    return () => {
      clearInterval(pruneCursors)
      socket.off('board:update', onUpdate)
      socket.off('board:pointer', onPointer)
      socket.off('board:locked', onLocked)
      socket.io.off('reconnect', onReconnect)
    }
  }, [socket, api, meetingId])

  // Sending our cursor
  const lastPointerSent = useRef(0)
  const onPointerUpdate = useCallback(
    ({ pointer }: { pointer: { x: number; y: number } }) => {
      const now = Date.now()
      if (!socket?.connected || now - lastPointerSent.current < POINTER_EVERY_MS) return
      lastPointerSent.current = now
      socket.emit('board:pointer', { meetingId, x: pointer.x, y: pointer.y })
    },
    [socket, meetingId],
  )

  // Teacher controls
  const emitOrThrow = async (event: 'board:lock' | 'board:clear', locked?: boolean) => {
    if (!socket?.connected) throw new ApiError(0, 'INTERNAL_ERROR', 'Not connected.')
    const result =
      event === 'board:lock'
        ? await socket.timeout(5000).emitWithAck('board:lock', { meetingId, locked: !!locked })
        : await socket.timeout(5000).emitWithAck('board:clear', { meetingId })
    if (!result.ok) throw new ApiError(0, result.error.code, result.error.message)
  }
  const setLocked = useMutation({
    mutationFn: (locked: boolean) => emitOrThrow('board:lock', locked),
  })
  const clear = useMutation({ mutationFn: () => emitOrThrow('board:clear') })

  const locked = lockedByEvent ?? board.data?.locked ?? true

  return {
    board: board.data,
    isLoading: board.isPending,
    error: board.error,
    locked,
    /** Students can only look while the board is locked; the teacher can always draw. */
    readOnly: locked && !isTeacher,
    setApi,
    onChange: scheduleSend,
    onPointerUpdate,
    setLocked,
    clear,
  }
}
