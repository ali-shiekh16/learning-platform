import type {
  Difficulty,
  GameStatus,
  PublicUser,
  Report,
  ReportList,
  ReportListQuery,
  ReportSummary,
} from '@app/shared'
import type { prisma as prismaClient } from '../../db/prisma'
import type { SudokuGame } from '../../generated/prisma/client'
import { forbidden, notFound } from '../../lib/errors'
import { accuracy, wrongCells } from '../sudoku/scoring'
import type { SudokuService } from '../sudoku/sudoku.service'

interface Deps {
  prisma: typeof prismaClient
  sudoku: SudokuService
}

type GameWithUser = SudokuGame & { user: { id: string; name: string } }

const MAX_REPORTS = 200

function toSummary(game: GameWithUser): ReportSummary {
  const endedAt = game.endedAt!
  return {
    id: game.id,
    student: { id: game.user.id, name: game.user.name },
    difficulty: game.difficulty as Difficulty,
    status: game.status as GameStatus,
    score: game.score ?? 0,
    correctCount: game.correctCount,
    mistakes: game.mistakes,
    accuracy: accuracy(game.correctCount, game.mistakes),
    durationS: Math.floor((endedAt.getTime() - game.startedAt.getTime()) / 1000),
    startedAt: game.startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
  }
}

export type ReportsService = ReturnType<typeof createReportsService>

/** A report is a finished game; nothing extra is stored. */
export function createReportsService({ prisma, sudoku }: Deps) {
  /** Whose reports `user` may see: themself, or (teachers) students who attended their meetings. */
  async function visibleStudents(user: PublicUser) {
    if (user.role !== 'TEACHER') return [{ id: user.id, name: user.name }]
    return prisma.user.findMany({
      where: {
        role: 'STUDENT',
        meetingParticipants: { some: { meeting: { teacherId: user.id } } },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
  }

  return {
    async list(user: PublicUser, query: ReportListQuery): Promise<ReportList> {
      const students = await visibleStudents(user)
      if (query.studentId && !students.some(s => s.id === query.studentId))
        throw forbidden('You can only see reports of your own students')

      const userIds = query.studentId ? [query.studentId] : students.map(s => s.id)
      await sudoku.settleExpiredGames(userIds)

      const games = await prisma.sudokuGame.findMany({
        where: { userId: { in: userIds }, status: { not: 'IN_PROGRESS' } },
        include: { user: { select: { id: true, name: true } } },
        orderBy:
          query.sort === 'score' ? [{ score: 'desc' }, { endedAt: 'desc' }] : [{ endedAt: 'desc' }],
        take: MAX_REPORTS,
      })
      return { reports: games.map(toSummary), students }
    },

    async get(user: PublicUser, gameId: string): Promise<Report> {
      const game = await prisma.sudokuGame.findUnique({
        where: { id: gameId },
        include: { user: { select: { id: true, name: true } } },
      })
      // A game still being played has no report yet.
      if (!game || game.status === 'IN_PROGRESS') throw notFound('Report')

      if (game.userId !== user.id) {
        const students = user.role === 'TEACHER' ? await visibleStudents(user) : []
        // Same answer as a missing report: no hint that it exists.
        if (!students.some(s => s.id === game.userId)) throw notFound('Report')
      }

      return {
        ...toSummary(game),
        puzzle: game.puzzle,
        board: game.board,
        wrongCells: wrongCells(game.puzzle, game.board, game.solution),
      }
    },
  }
}
