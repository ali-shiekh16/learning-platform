import {
  DIFFICULTY_SETTINGS,
  MAX_MISTAKES,
  type Difficulty,
  type Game,
  type GameStatus,
  type MoveInput,
  type MoveResult,
  type PublicUser,
} from '@app/shared'
import type { prisma as prismaClient } from '../../db/prisma'
import type { Prisma, SudokuGame } from '../../generated/prisma/client'
import { isUniqueViolation } from '../../lib/db-errors'
import { AppError, conflict, notFound } from '../../lib/errors'
import { createSlidingWindowLimiter } from '../../lib/sliding-window-limiter'
import { computeScore, wrongCells } from './scoring'
import { generatePuzzle } from './sudoku-engine'

interface Deps {
  prisma: typeof prismaClient
  /** The clock; tests replace it to make time pass. */
  now?: () => Date
}

type Tx = Prisma.TransactionClient

// A person places at most a couple of values per second; this only stops scripts.
export const MOVE_RATE_LIMIT = { limit: 10, windowMs: 1000 }

const deadlineOf = (game: SudokuGame) => new Date(game.startedAt.getTime() + game.timeLimitS * 1000)

/** Seconds left: now for a running game, at the moment it ended for a finished one. */
function secondsLeft(game: SudokuGame, now: Date) {
  const until = game.endedAt ?? now
  return Math.max(0, Math.floor((deadlineOf(game).getTime() - until.getTime()) / 1000))
}

export function toGameDto(game: SudokuGame, now: Date): Game {
  return {
    id: game.id,
    difficulty: game.difficulty as Difficulty,
    status: game.status as GameStatus,
    puzzle: game.puzzle,
    board: game.board,
    wrongCells: wrongCells(game.puzzle, game.board, game.solution),
    correctCount: game.correctCount,
    mistakes: game.mistakes,
    score: game.score,
    timeLimitS: game.timeLimitS,
    secondsLeft: secondsLeft(game, now),
    startedAt: game.startedAt.toISOString(),
    endedAt: game.endedAt?.toISOString() ?? null,
  }
}

const isExpired = (game: SudokuGame, now: Date) =>
  game.status === 'IN_PROGRESS' && now >= deadlineOf(game)

/**
 * The fields that end a game: status, end time and the final score. A game that ran
 * out of time ends at its deadline, not whenever someone next looked at it.
 */
function endGame(game: SudokuGame, status: GameStatus, now: Date) {
  const endedAt = status === 'TIMED_OUT' ? deadlineOf(game) : now
  const score = computeScore({
    difficulty: game.difficulty as Difficulty,
    status,
    correctCount: game.correctCount,
    mistakes: game.mistakes,
    secondsLeft: secondsLeft({ ...game, endedAt }, endedAt),
  })
  return { status, endedAt, score }
}

export type SudokuService = ReturnType<typeof createSudokuService>

export function createSudokuService({ prisma, now = () => new Date() }: Deps) {
  const limiter = createSlidingWindowLimiter(MOVE_RATE_LIMIT)

  /**
   * Reads the user's game and locks its row until the transaction ends (SELECT … FOR
   * UPDATE). A second request for the same game waits here, then sees the first one's
   * result: two quick moves can't both read "4 mistakes" and both write 5.
   */
  async function lockGame(tx: Tx, user: PublicUser, gameId: string) {
    await tx.$queryRaw`SELECT 1 FROM sudoku_games WHERE id = ${gameId} FOR UPDATE`
    const game = await tx.sudokuGame.findUnique({ where: { id: gameId } })
    // Someone else's game looks the same as a missing one: no hint that it exists.
    if (!game || game.userId !== user.id) throw notFound('Game')
    return game
  }

  /** Ends the game as TIMED_OUT if its deadline has passed ("on next access", per spec). */
  async function settleExpired(tx: Tx, game: SudokuGame, at: Date) {
    if (!isExpired(game, at)) return game
    return tx.sudokuGame.update({
      where: { id: game.id },
      data: endGame(game, 'TIMED_OUT', at),
    })
  }

  return {
    /** The user's game in progress, if any (finalizing it if its time ran out). */
    async current(user: PublicUser): Promise<Game | null> {
      const at = now()
      const open = await prisma.sudokuGame.findFirst({
        where: { userId: user.id, status: 'IN_PROGRESS' },
      })
      if (!open) return null
      const game = await prisma.$transaction(async tx =>
        settleExpired(tx, await lockGame(tx, user, open.id), at),
      )
      return game.status === 'IN_PROGRESS' ? toGameDto(game, at) : null
    },

    async get(user: PublicUser, gameId: string): Promise<Game> {
      const at = now()
      const game = await prisma.$transaction(async tx =>
        settleExpired(tx, await lockGame(tx, user, gameId), at),
      )
      return toGameDto(game, at)
    },

    /** Starts a new game; a game still open is ended first (ABANDONED, or TIMED_OUT). */
    async start(user: PublicUser, difficulty: Difficulty): Promise<Game> {
      const settings = DIFFICULTY_SETTINGS[difficulty]
      // CPU work (a few ms) done before the transaction, so no row stays locked meanwhile.
      const { puzzle, solution } = generatePuzzle(settings.givens)
      const at = now()

      try {
        const game = await prisma.$transaction(async tx => {
          const open = await tx.sudokuGame.findFirst({
            where: { userId: user.id, status: 'IN_PROGRESS' },
          })
          if (open) {
            const locked = await lockGame(tx, user, open.id)
            if (locked.status === 'IN_PROGRESS') {
              await tx.sudokuGame.update({
                where: { id: locked.id },
                data: endGame(locked, isExpired(locked, at) ? 'TIMED_OUT' : 'ABANDONED', at),
              })
            }
          }
          return tx.sudokuGame.create({
            data: {
              userId: user.id,
              difficulty,
              puzzle,
              solution,
              board: puzzle,
              timeLimitS: settings.timeLimitS,
              startedAt: at,
            },
          })
        })
        return toGameDto(game, at)
      } catch (error) {
        // The partial unique index: another "start" for this user won the race.
        if (isUniqueViolation(error)) throw conflict('A new game is already starting')
        throw error
      }
    },

    async move(
      user: PublicUser,
      gameId: string,
      { row, col, value }: MoveInput,
    ): Promise<MoveResult> {
      const at = now()
      if (!limiter.tryConsume(user.id, at.getTime()))
        throw new AppError('RATE_LIMITED', 'Slow down a little')
      const cell = row * 9 + col

      const outcome = await prisma.$transaction(async tx => {
        const game = await settleExpired(tx, await lockGame(tx, user, gameId), at)
        // Returned, not thrown: throwing would roll back the TIMED_OUT update above.
        if (game.status !== 'IN_PROGRESS') return { ended: true as const, game }

        const current = game.board[cell]!
        if (game.puzzle[cell] !== '0') throw conflict('That cell is part of the puzzle')
        if (current !== '0' && current === game.solution[cell])
          throw conflict('That cell is already solved')
        // Same value again: nothing to do, and certainly not a second mistake.
        if (current === String(value)) return { ended: false as const, correct: false, game }

        const correct = value !== 0 && String(value) === game.solution[cell]
        const board = game.board.slice(0, cell) + value + game.board.slice(cell + 1)
        const correctCount = game.correctCount + (correct ? 1 : 0)
        const mistakes = game.mistakes + (value !== 0 && !correct ? 1 : 0)
        const next = { ...game, board, correctCount, mistakes }

        const status: GameStatus | null =
          board === game.solution ? 'COMPLETED' : mistakes >= MAX_MISTAKES ? 'FAILED' : null

        await tx.sudokuMove.create({ data: { gameId, row, col, value, isCorrect: correct } })
        const updated = await tx.sudokuGame.update({
          where: { id: gameId },
          data: { board, correctCount, mistakes, ...(status && endGame(next, status, at)) },
        })
        return { ended: false as const, correct, game: updated }
      })

      if (outcome.ended) {
        throw conflict(
          outcome.game.status === 'TIMED_OUT' ? 'Time is up' : 'This game has already ended',
        )
      }
      return { correct: outcome.correct, game: toGameDto(outcome.game, at) }
    },

    /**
     * Finalizes these users' games whose time ran out. Reports call this first, so a game
     * left open in a closed tab still shows up as TIMED_OUT instead of disappearing.
     */
    async settleExpiredGames(userIds: string[]) {
      const at = now()
      const shortestLimitMs = Math.min(
        ...Object.values(DIFFICULTY_SETTINGS).map(s => s.timeLimitS * 1000),
      )
      const candidates = await prisma.sudokuGame.findMany({
        where: {
          userId: { in: userIds },
          status: 'IN_PROGRESS',
          startedAt: { lte: new Date(at.getTime() - shortestLimitMs) },
        },
      })
      for (const candidate of candidates.filter(game => isExpired(game, at))) {
        await prisma.$transaction(async tx => {
          const locked = await tx.sudokuGame.findUnique({ where: { id: candidate.id } })
          if (locked) await settleExpired(tx, locked, at)
        })
      }
    },

    /** The player stops: ABANDONED, or TIMED_OUT if the time had already run out. */
    async finish(user: PublicUser, gameId: string): Promise<Game> {
      const at = now()
      const game = await prisma.$transaction(async tx => {
        const locked = await settleExpired(tx, await lockGame(tx, user, gameId), at)
        if (locked.status !== 'IN_PROGRESS') return locked
        return tx.sudokuGame.update({
          where: { id: gameId },
          data: endGame(locked, 'ABANDONED', at),
        })
      })
      return toGameDto(game, at)
    },
  }
}
