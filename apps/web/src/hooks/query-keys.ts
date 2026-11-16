// Keys are matched by prefix when invalidating, so unrelated data must not share a
// prefix: refreshing the meetings list must never refetch an open meeting's session
// (that would mean a new LiveKit token and a reconnect).
export const queryKeys = {
  currentUser: ['current-user'] as const,
  meetingList: ['meeting-list'] as const,
  meetingSession: (meetingId: string) => ['meeting-session', meetingId] as const,
  chat: (meetingId: string) => ['meeting-chat', meetingId] as const,
  whiteboard: (meetingId: string) => ['meeting-whiteboard', meetingId] as const,
  currentGame: ['sudoku-current-game'] as const,
  game: (gameId: string) => ['sudoku-game', gameId] as const,
  reports: ['reports'] as const,
  reportList: (query: { sort: string; studentId?: string | undefined }) =>
    ['reports', 'list', query] as const,
  report: (gameId: string) => ['reports', 'detail', gameId] as const,
}
