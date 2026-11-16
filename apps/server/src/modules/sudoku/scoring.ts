import { DIFFICULTY_SETTINGS, type Difficulty, type GameStatus } from '@app/shared'

/**
 * The spec's score formula:
 *   base      = correct × 10 − mistakes × 20
 *   timeBonus = remaining seconds, only for a COMPLETED game
 *   score     = max(0, round((base + timeBonus) × difficulty multiplier))
 */
export function computeScore(game: {
  difficulty: Difficulty
  status: GameStatus
  correctCount: number
  mistakes: number
  secondsLeft: number
}): number {
  const base = game.correctCount * 10 - game.mistakes * 20
  const timeBonus = game.status === 'COMPLETED' ? game.secondsLeft : 0
  const { multiplier } = DIFFICULTY_SETTINGS[game.difficulty]
  return Math.max(0, Math.round((base + timeBonus) * multiplier))
}

/** % of placed values that were correct (0 when nothing was placed). */
export function accuracy(correctCount: number, mistakes: number): number {
  const placed = correctCount + mistakes
  return placed === 0 ? 0 : Math.round((correctCount / placed) * 100)
}

/** Cells the player filled that don't match the solution. */
export function wrongCells(puzzle: string, board: string, solution: string): number[] {
  const wrong: number[] = []
  for (let i = 0; i < 81; i++)
    if (puzzle[i] === '0' && board[i] !== '0' && board[i] !== solution[i]) wrong.push(i)
  return wrong
}
