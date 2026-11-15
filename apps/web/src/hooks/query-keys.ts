// Keys are matched by prefix when invalidating, so unrelated data must not share a
// prefix: refreshing the meetings list must never refetch an open meeting's session
// (that would mean a new LiveKit token and a reconnect).
export const queryKeys = {
  currentUser: ['current-user'] as const,
  meetingList: ['meeting-list'] as const,
  meetingSession: (meetingId: string) => ['meeting-session', meetingId] as const,
  chat: (meetingId: string) => ['meeting-chat', meetingId] as const,
}
