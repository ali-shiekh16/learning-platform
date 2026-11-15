import type { IoServer } from './socket'

export const meetingRoom = (meetingId: string) => `meeting:${meetingId}`
export const userRoom = (userId: string) => `user:${userId}`

export interface RealtimeNotifier {
  meetingEnded(meetingId: string): void
  participantRemoved(meetingId: string, userId: string): void
}

export function createRealtimeNotifier(io: IoServer): RealtimeNotifier {
  return {
    meetingEnded(meetingId) {
      const room = meetingRoom(meetingId)
      io.to(room).emit('meeting:ended', { meetingId })
      io.in(room).socketsLeave(room)
    },

    participantRemoved(meetingId, userId) {
      io.to(userRoom(userId)).emit('participant:removed', { meetingId, userId })
      io.in(userRoom(userId)).socketsLeave(meetingRoom(meetingId))
    },
  }
}
