import { z } from 'zod'

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const
export const difficultySchema = z.enum(DIFFICULTIES)
export type Difficulty = z.infer<typeof difficultySchema>

export const DIFFICULTY_SETTINGS: Record<
  Difficulty,
  { label: string; givens: number; timeLimitS: number; multiplier: number }
> = {
  EASY: { label: 'Easy', givens: 40, timeLimitS: 10 * 60, multiplier: 1 },
  MEDIUM: { label: 'Medium', givens: 32, timeLimitS: 15 * 60, multiplier: 1.5 },
  HARD: { label: 'Hard', givens: 26, timeLimitS: 20 * 60, multiplier: 2 },
}

export const GAME_STATUSES = [
  'IN_PROGRESS',
  'COMPLETED',
  'TIMED_OUT',
  'FAILED',
  'ABANDONED',
] as const
export const gameStatusSchema = z.enum(GAME_STATUSES)
export type GameStatus = z.infer<typeof gameStatusSchema>

/** Reaching this many mistakes ends the game as FAILED. */
export const MAX_MISTAKES = 5

/** 81 characters, row by row, `0` for an empty cell. */
export const gridSchema = z.string().regex(/^[0-9]{81}$/)

export const startGameSchema = z.object({ difficulty: difficultySchema })
export type StartGameInput = z.infer<typeof startGameSchema>

export const gameIdParamsSchema = z.object({ id: z.string().min(1) })

/** Place `value` (1–9) in a cell, or 0 to clear a wrong entry. */
export const moveSchema = z.object({
  row: z.number().int().min(0).max(8),
  col: z.number().int().min(0).max(8),
  value: z.number().int().min(0).max(9),
})
export type MoveInput = z.infer<typeof moveSchema>

/** A game as the player sees it. Never contains the solution. */
export const gameSchema = z.object({
  id: z.string(),
  difficulty: difficultySchema,
  status: gameStatusSchema,
  puzzle: gridSchema, // the givens
  board: gridSchema, // givens + everything placed, wrong values included
  wrongCells: z.array(z.number().int()), // indexes (0–80) of cells currently holding a wrong value
  correctCount: z.number().int(),
  mistakes: z.number().int(),
  score: z.number().int().nullable(), // set when the game ends
  timeLimitS: z.number().int(),
  // From the server's clock, so a wrong clock on the player's computer doesn't matter.
  secondsLeft: z.number().int(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
})
export type Game = z.infer<typeof gameSchema>

export const moveResultSchema = z.object({ correct: z.boolean(), game: gameSchema })
export type MoveResult = z.infer<typeof moveResultSchema>

// ─── Reports ────────────────────────────────────────────────────────────────

/** One row of a report list. A report is a finished game. */
export const reportSummarySchema = z.object({
  id: z.string(),
  student: z.object({ id: z.string(), name: z.string() }),
  difficulty: difficultySchema,
  status: gameStatusSchema,
  score: z.number().int(),
  correctCount: z.number().int(),
  mistakes: z.number().int(),
  accuracy: z.number().int(), // % of placed values that were correct
  durationS: z.number().int(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime(),
})
export type ReportSummary = z.infer<typeof reportSummarySchema>

/** The full report: the summary plus the final grid. */
export const reportSchema = reportSummarySchema.extend({
  puzzle: gridSchema,
  board: gridSchema,
  wrongCells: z.array(z.number().int()),
})
export type Report = z.infer<typeof reportSchema>

export const REPORT_SORTS = ['date', 'score'] as const
export const reportListQuerySchema = z.object({
  studentId: z.string().min(1).optional(),
  sort: z.enum(REPORT_SORTS).default('date'),
})
export type ReportListQuery = z.infer<typeof reportListQuerySchema>

export const reportListSchema = z.object({
  reports: z.array(reportSummarySchema),
  // Who the viewer may filter by: the student themself, or a teacher's students.
  students: z.array(z.object({ id: z.string(), name: z.string() })),
})
export type ReportList = z.infer<typeof reportListSchema>
