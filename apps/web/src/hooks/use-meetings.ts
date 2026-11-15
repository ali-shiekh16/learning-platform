import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateMeetingInput } from '@app/shared'
import * as meetingsService from '@/services/meetings.service'
import { queryKeys } from './query-keys'
import { useSocket } from './use-socket'

/** Meetings list. Refreshed every 15 s so new live meetings appear without a reload. */
export function useMeetings() {
  return useQuery({
    queryKey: queryKeys.meetingList,
    queryFn: ({ signal }) => meetingsService.listMeetings(signal),
    refetchInterval: 15_000,
  })
}

export function useCreateMeeting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateMeetingInput) => meetingsService.createMeeting(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.meetingList }),
  })
}

export function useJoinMeetingByCode() {
  return useMutation({ mutationFn: (code: string) => meetingsService.joinMeetingByCode(code) })
}

/**
 * Joins the meeting and fetches its LiveKit token, once per visit to the room.
 * Never refetched in the background: a new token would mean reconnecting the call.
 */
export function useMeetingSession(meetingId: string) {
  return useQuery({
    queryKey: queryKeys.meetingSession(meetingId),
    queryFn: ({ signal }) => meetingsService.enterMeeting(meetingId, signal),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  })
}

export function useEndMeeting(meetingId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => meetingsService.endMeeting(meetingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.meetingList }),
  })
}

export function useMuteParticipant(meetingId: string) {
  return useMutation({
    mutationFn: (userId: string) => meetingsService.muteParticipant(meetingId, userId),
  })
}

export function useRemoveParticipant(meetingId: string) {
  return useMutation({
    mutationFn: (userId: string) => meetingsService.removeParticipant(meetingId, userId),
  })
}

/**
 * Keeps this browser in the meeting's real-time room while the page is open:
 * joins on mount and again after every reconnect (a new connection starts in no
 * rooms), leaves on unmount, and reports the server's meeting events.
 */
export function useMeetingRoom(
  meetingId: string,
  userId: string,
  handlers: { onEnded: () => void; onRemoved: () => void },
) {
  const { socket } = useSocket()
  // Latest handlers without re-running the effect when the caller passes new functions.
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    if (!socket) return

    const join = () => void socket.emit('meeting:join', { meetingId }, () => {})
    const onEnded = (payload: { meetingId: string }) => {
      if (payload.meetingId === meetingId) handlersRef.current.onEnded()
    }
    const onRemoved = (payload: { meetingId: string; userId: string }) => {
      if (payload.meetingId === meetingId && payload.userId === userId)
        handlersRef.current.onRemoved()
    }

    if (socket.connected) join()
    socket.on('connect', join)
    socket.on('meeting:ended', onEnded)
    socket.on('participant:removed', onRemoved)

    return () => {
      socket.off('connect', join)
      socket.off('meeting:ended', onEnded)
      socket.off('participant:removed', onRemoved)
      socket.emit('meeting:leave', { meetingId })
    }
  }, [socket, meetingId, userId])
}
