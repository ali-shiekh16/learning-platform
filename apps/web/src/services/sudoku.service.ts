import {
  gameSchema,
  moveResultSchema,
  reportListSchema,
  reportSchema,
  type Difficulty,
  type Game,
  type MoveInput,
  type MoveResult,
  type Report,
  type ReportList,
  type ReportListQuery,
} from '@app/shared'
import { http } from './http'

const post = (body?: unknown) => ({
  method: 'POST',
  ...(body !== undefined && { body: JSON.stringify(body) }),
})

/** The student's game in progress, or null. */
export async function getCurrentGame(signal?: AbortSignal): Promise<Game | null> {
  return gameSchema.nullable().parse(await http('/api/sudoku/games/current', { signal }))
}

export async function startGame(difficulty: Difficulty): Promise<Game> {
  return gameSchema.parse(await http('/api/sudoku/games', post({ difficulty })))
}

export async function getGame(gameId: string, signal?: AbortSignal): Promise<Game> {
  return gameSchema.parse(await http(`/api/sudoku/games/${gameId}`, { signal }))
}

export async function placeValue(gameId: string, move: MoveInput): Promise<MoveResult> {
  return moveResultSchema.parse(await http(`/api/sudoku/games/${gameId}/moves`, post(move)))
}

export async function finishGame(gameId: string): Promise<Game> {
  return gameSchema.parse(await http(`/api/sudoku/games/${gameId}/finish`, post()))
}

export async function listReports(
  query: ReportListQuery,
  signal?: AbortSignal,
): Promise<ReportList> {
  const params = new URLSearchParams({
    sort: query.sort,
    ...(query.studentId && { studentId: query.studentId }),
  })
  return reportListSchema.parse(await http(`/api/reports?${params}`, { signal }))
}

export async function getReport(gameId: string, signal?: AbortSignal): Promise<Report> {
  return reportSchema.parse(await http(`/api/reports/${gameId}`, { signal }))
}
