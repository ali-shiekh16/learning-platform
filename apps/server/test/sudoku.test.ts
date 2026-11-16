import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  DIFFICULTY_SETTINGS,
  MAX_MISTAKES,
  type Game,
  type MoveResult,
  type Report,
  type ReportList,
} from '@app/shared'
import { buildApp, type App } from '../src/app'
import { prisma } from '../src/db/prisma'
import {
  createFakeLiveKit,
  createMeeting,
  joinMeeting,
  request,
  signUp,
  type TestUser,
} from './helpers'

// The Sudoku service reads this clock, so tests can make time pass.
let clock = new Date('2026-11-16T10:00:00Z')
const tick = (ms: number) => (clock = new Date(clock.getTime() + ms))

let app: App
beforeAll(async () => {
  app = await buildApp({}, { livekit: createFakeLiveKit().gateway, now: () => clock })
})
afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

let student: TestUser
beforeEach(async () => {
  clock = new Date('2026-11-16T10:00:00Z')
  student = await signUp(app)
})

async function start(user: TestUser, difficulty = 'EASY') {
  const res = await request(app, user, 'POST', '/api/sudoku/games', { difficulty })
  expect(res.statusCode).toBe(201)
  return res.json<Game>()
}

/** Tests may peek at the solution in the database; the API never sends it. */
const solutionOf = async (gameId: string) =>
  (await prisma.sudokuGame.findUniqueOrThrow({ where: { id: gameId } })).solution

const emptyCells = (game: Game) => [...game.puzzle].flatMap((c, i) => (c === '0' ? [i] : []))

/** A move, 200 ms after the previous one (well inside the rate limit). */
function move(user: TestUser, gameId: string, cell: number, value: number) {
  tick(200)
  return request(app, user, 'POST', `/api/sudoku/games/${gameId}/moves`, {
    row: Math.floor(cell / 9),
    col: cell % 9,
    value,
  })
}

const wrongValueFor = (solution: string, cell: number) => (Number(solution[cell]) % 9) + 1

describe('starting a game', () => {
  it('returns the puzzle and never the solution', async () => {
    const res = await request(app, student, 'POST', '/api/sudoku/games', { difficulty: 'HARD' })
    expect(res.statusCode).toBe(201)
    const game = res.json<Game>()
    const solution = await solutionOf(game.id)

    expect(res.body).not.toContain(solution)
    expect(Object.keys(game)).not.toContain('solution')
    expect(emptyCells(game)).toHaveLength(81 - DIFFICULTY_SETTINGS.HARD.givens)
    expect(game).toMatchObject({
      status: 'IN_PROGRESS',
      board: game.puzzle,
      mistakes: 0,
      secondsLeft: DIFFICULTY_SETTINGS.HARD.timeLimitS,
    })
  })

  it('is for students only', async () => {
    const teacher = await signUp(app, 'TEACHER')
    const res = await request(app, teacher, 'POST', '/api/sudoku/games', { difficulty: 'EASY' })
    expect(res.statusCode).toBe(403)
  })

  it('ends the game still open when a new one starts', async () => {
    const first = await start(student)
    const second = await start(student)
    const old = await request(app, student, 'GET', `/api/sudoku/games/${first.id}`)
    expect(old.json<Game>().status).toBe('ABANDONED')

    const current = await request(app, student, 'GET', '/api/sudoku/games/current')
    expect(current.json<Game>().id).toBe(second.id)
  })

  it('never leaves two games open, even for simultaneous starts', async () => {
    const results = await Promise.all([
      request(app, student, 'POST', '/api/sudoku/games', { difficulty: 'EASY' }),
      request(app, student, 'POST', '/api/sudoku/games', { difficulty: 'EASY' }),
    ])
    for (const res of results) expect([201, 409]).toContain(res.statusCode)
    const open = await prisma.sudokuGame.findFirstOrThrow({
      where: { userId: student.id, status: 'IN_PROGRESS' },
    })

    // The guarantee is the partial unique index: the database itself refuses a second one.
    const second = prisma.sudokuGame.create({
      data: { ...open, id: undefined, startedAt: undefined },
    })
    await expect(second).rejects.toMatchObject({ code: 'P2002' })
  })
})

describe('moves', () => {
  it('answers correct or not, and keeps count', async () => {
    const game = await start(student)
    const solution = await solutionOf(game.id)
    const [a, b] = emptyCells(game)

    const right = await move(student, game.id, a!, Number(solution[a!]))
    expect(right.json<MoveResult>()).toMatchObject({ correct: true, game: { correctCount: 1 } })

    const wrong = await move(student, game.id, b!, wrongValueFor(solution, b!))
    const after = wrong.json<MoveResult>()
    expect(after).toMatchObject({ correct: false, game: { mistakes: 1 } })
    expect(after.game.wrongCells).toEqual([b])

    const moves = await prisma.sudokuMove.findMany({ where: { gameId: game.id } })
    expect(moves.map(m => m.isCorrect)).toEqual([true, false])
  })

  it('protects the puzzle and solved cells, and doesn’t double-count', async () => {
    const game = await start(student)
    const solution = await solutionOf(game.id)
    const given = [...game.puzzle].findIndex(c => c !== '0')
    const [empty, other] = emptyCells(game)

    expect((await move(student, game.id, given, 1)).statusCode).toBe(409)

    await move(student, game.id, empty!, Number(solution[empty!]))
    // A correct cell is locked in: no clearing it and scoring it again.
    expect((await move(student, game.id, empty!, 0)).statusCode).toBe(409)

    const wrong = wrongValueFor(solution, other!)
    await move(student, game.id, other!, wrong)
    const again = await move(student, game.id, other!, wrong)
    expect(again.json<MoveResult>().game.mistakes).toBe(1)

    const cleared = await move(student, game.id, other!, 0)
    expect(cleared.json<MoveResult>().game).toMatchObject({ mistakes: 1, wrongCells: [] })
  })

  it(`fails the game on the ${MAX_MISTAKES}th mistake`, async () => {
    const game = await start(student)
    const solution = await solutionOf(game.id)
    const cells = emptyCells(game).slice(0, MAX_MISTAKES)

    let last: MoveResult | undefined
    for (const cell of cells)
      last = (await move(student, game.id, cell, wrongValueFor(solution, cell))).json<MoveResult>()
    expect(last!.game).toMatchObject({ status: 'FAILED', mistakes: MAX_MISTAKES, score: 0 })

    const late = await move(student, game.id, emptyCells(game)[MAX_MISTAKES]!, 1)
    expect(late.statusCode).toBe(409)
  })

  it('completes the game and scores it with the time bonus', async () => {
    const game = await start(student, 'MEDIUM')
    const solution = await solutionOf(game.id)
    const cells = emptyCells(game)

    // One mistake on the way.
    await move(student, game.id, cells[0]!, wrongValueFor(solution, cells[0]!))
    let last: MoveResult | undefined
    for (const cell of cells)
      last = (await move(student, game.id, cell, Number(solution[cell]))).json<MoveResult>()

    const finished = last!.game
    expect(finished.status).toBe('COMPLETED')
    expect(finished.board).toBe(solution)
    // (correct × 10 − mistakes × 20 + seconds left) × 1.5
    const expected = Math.round((cells.length * 10 - 20 + finished.secondsLeft) * 1.5)
    expect(finished.score).toBe(expected)
    expect(finished.secondsLeft).toBe(
      DIFFICULTY_SETTINGS.MEDIUM.timeLimitS - (cells.length + 1) / 5,
    )
  })

  it('waits for a game locked by another request, then sees its result (row lock)', async () => {
    const game = await start(student)
    const solution = await solutionOf(game.id)
    const cell = emptyCells(game)[0]!
    const order: string[] = []

    // Another request holds the game's row lock and records 4 mistakes before committing.
    let locked!: () => void
    const isLocked = new Promise<void>(resolve => (locked = resolve))
    const other = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 FROM sudoku_games WHERE id = ${game.id} FOR UPDATE`
      locked()
      await new Promise(resolve => setTimeout(resolve, 300))
      await tx.sudokuGame.update({
        where: { id: game.id },
        data: { mistakes: MAX_MISTAKES - 1 },
      })
      order.push('other request committed')
    })

    await isLocked
    const res = await move(student, game.id, cell, wrongValueFor(solution, cell))
    order.push('move answered')
    await other

    // The move waited for the lock, then counted on top of the other request's 4 mistakes.
    // Without FOR UPDATE it would read the old row (0 mistakes) and answer first.
    expect(order).toEqual(['other request committed', 'move answered'])
    expect(res.json<MoveResult>().game).toMatchObject({ status: 'FAILED', mistakes: MAX_MISTAKES })
  })

  it('is private to its player', async () => {
    const game = await start(student)
    const other = await signUp(app)
    expect((await request(app, other, 'GET', `/api/sudoku/games/${game.id}`)).statusCode).toBe(404)
    expect((await move(other, game.id, emptyCells(game)[0]!, 1)).statusCode).toBe(404)
  })
})

describe('the timer', () => {
  it('counts down on the server and rejects moves after the deadline', async () => {
    const game = await start(student)
    tick(60_000)
    const resumed = await request(app, student, 'GET', `/api/sudoku/games/${game.id}`)
    expect(resumed.json<Game>().secondsLeft).toBe(DIFFICULTY_SETTINGS.EASY.timeLimitS - 60)

    tick(DIFFICULTY_SETTINGS.EASY.timeLimitS * 1000)
    const late = await move(student, game.id, emptyCells(game)[0]!, 1)
    expect(late.statusCode).toBe(409)
    expect(late.json()).toMatchObject({ error: { message: 'Time is up' } })

    const saved = await prisma.sudokuGame.findUniqueOrThrow({ where: { id: game.id } })
    expect(saved.status).toBe('TIMED_OUT')
    // It ended at its deadline, not when someone next looked.
    expect(saved.endedAt!.getTime() - saved.startedAt.getTime()).toBe(
      DIFFICULTY_SETTINGS.EASY.timeLimitS * 1000,
    )
  })

  it('quitting abandons the game; finishing after the deadline is TIMED_OUT', async () => {
    const quit = await start(student)
    const res = await request(app, student, 'POST', `/api/sudoku/games/${quit.id}/finish`)
    expect(res.json<Game>().status).toBe('ABANDONED')

    const late = await start(student)
    tick((DIFFICULTY_SETTINGS.EASY.timeLimitS + 5) * 1000)
    const done = await request(app, student, 'POST', `/api/sudoku/games/${late.id}/finish`)
    expect(done.json<Game>()).toMatchObject({ status: 'TIMED_OUT', secondsLeft: 0 })
  })
})

describe('reports', () => {
  let teacher: TestUser
  beforeEach(async () => {
    teacher = await signUp(app, 'TEACHER')
    const meeting = await createMeeting(app, teacher)
    await joinMeeting(app, student, meeting.id)
  })

  async function playAndQuit(user: TestUser, correctMoves: number) {
    const game = await start(user)
    const solution = await solutionOf(game.id)
    for (const cell of emptyCells(game).slice(0, correctMoves))
      await move(user, game.id, cell, Number(solution[cell]))
    await move(
      user,
      game.id,
      emptyCells(game)[correctMoves]!,
      wrongValueFor(solution, emptyCells(game)[correctMoves]!),
    )
    await request(app, user, 'POST', `/api/sudoku/games/${game.id}/finish`)
    return game
  }

  it('gives the student a full report of their own games', async () => {
    const game = await playAndQuit(student, 3)
    const list = (await request(app, student, 'GET', '/api/reports')).json<ReportList>()
    expect(list.reports.map(r => r.id)).toEqual([game.id])
    expect(list.students).toEqual([expect.objectContaining({ id: student.id })])

    const report = (await request(app, student, 'GET', `/api/reports/${game.id}`)).json<Report>()
    expect(report).toMatchObject({
      status: 'ABANDONED',
      correctCount: 3,
      mistakes: 1,
      accuracy: 75,
      score: 10, // 3 × 10 − 1 × 20
    })
    expect(report.wrongCells).toHaveLength(1)
  })

  it('shows teachers the students who attended their meetings, filtered and sorted', async () => {
    const low = await playAndQuit(student, 2)
    const high = await playAndQuit(student, 6)
    const stranger = await signUp(app)
    await playAndQuit(stranger, 4)

    const byScore = (
      await request(app, teacher, 'GET', '/api/reports?sort=score')
    ).json<ReportList>()
    expect(byScore.reports.map(r => r.id)).toEqual([high.id, low.id])
    expect(byScore.students.map(s => s.id)).toEqual([student.id])

    const filtered = await request(app, teacher, 'GET', `/api/reports?studentId=${student.id}`)
    expect(filtered.json<ReportList>().reports).toHaveLength(2)

    // Not their student: no list, no single report.
    const notMine = await request(app, teacher, 'GET', `/api/reports?studentId=${stranger.id}`)
    expect(notMine.statusCode).toBe(403)
    const otherTeacher = await signUp(app, 'TEACHER')
    const res = await request(app, otherTeacher, 'GET', `/api/reports/${high.id}`)
    expect(res.statusCode).toBe(404)
    expect((await request(app, teacher, 'GET', `/api/reports/${high.id}`)).statusCode).toBe(200)
  })

  it('includes games left open until their time ran out', async () => {
    const game = await start(student)
    tick((DIFFICULTY_SETTINGS.EASY.timeLimitS + 1) * 1000)
    const list = (await request(app, teacher, 'GET', '/api/reports')).json<ReportList>()
    expect(list.reports).toEqual([expect.objectContaining({ id: game.id, status: 'TIMED_OUT' })])
  })
})
