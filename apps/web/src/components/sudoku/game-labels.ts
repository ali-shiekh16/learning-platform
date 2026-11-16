import type { GameStatus } from '@app/shared'

export const STATUS_LABEL: Record<GameStatus, string> = {
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  TIMED_OUT: 'Time ran out',
  FAILED: 'Too many mistakes',
  ABANDONED: 'Quit',
}

export const STATUS_VARIANT: Record<
  GameStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  IN_PROGRESS: 'outline',
  COMPLETED: 'default',
  TIMED_OUT: 'secondary',
  FAILED: 'destructive',
  ABANDONED: 'secondary',
}

/** 754 → "12:34". */
export const formatSeconds = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
