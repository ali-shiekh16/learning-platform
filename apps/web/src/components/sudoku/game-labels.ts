import type { GameStatus } from '@app/shared'

export const STATUS_LABEL: Record<GameStatus, string> = {
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  TIMED_OUT: 'Time ran out',
  FAILED: 'Too many mistakes',
  ABANDONED: 'Quit',
}

/** Badge colours: green for a solved grid, red pen for too many mistakes, highlighter for time. */
export const STATUS_CLASS: Record<GameStatus, string> = {
  IN_PROGRESS: 'bg-secondary text-secondary-foreground',
  COMPLETED: 'bg-success/12 text-success',
  TIMED_OUT: 'bg-highlight text-highlight-foreground',
  FAILED: 'bg-destructive/10 text-destructive',
  ABANDONED: 'bg-muted text-muted-foreground',
}

/** 754 → "12:34". */
export const formatSeconds = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
