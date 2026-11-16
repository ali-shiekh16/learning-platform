import { describe, expect, it } from 'vitest'
import {
  countSolutions,
  generatePuzzle,
  isSolved,
  randomSolution,
  solve,
  type Random,
} from '../src/modules/sudoku/sudoku-engine'

/** Seeded random numbers (mulberry32), so failures can be reproduced. */
function seeded(seed: number): Random {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A well-known puzzle with a unique solution.
const PUZZLE = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'
const SOLUTION = '534678912672195348198342567859761423426853791713924856961537284287419635345286179'

const givens = (grid: string) => [...grid].filter(c => c !== '0').length

describe('solver', () => {
  it('solves a known puzzle', () => {
    expect(solve(PUZZLE)).toBe(SOLUTION)
    expect(countSolutions(PUZZLE)).toBe(1)
  })

  it('detects more than one solution', () => {
    // An empty grid has billions of solutions; counting stops at the limit (2).
    const ambiguous = '0'.repeat(81)
    expect(countSolutions(ambiguous)).toBe(2)
  })

  it('detects grids with no solution', () => {
    const broken = '55' + PUZZLE.slice(2) // two 5s in the first row
    expect(solve(broken)).toBeNull()
    expect(countSolutions(broken)).toBe(0)
  })

  it('checks complete solutions', () => {
    expect(isSolved(SOLUTION)).toBe(true)
    expect(isSolved(PUZZLE)).toBe(false)
    expect(isSolved('1' + SOLUTION.slice(1))).toBe(false)
  })
})

describe('generator', () => {
  it('fills random valid grids', () => {
    const random = seeded(1)
    const a = randomSolution(random)
    const b = randomSolution(random)
    expect(isSolved(a)).toBe(true)
    expect(isSolved(b)).toBe(true)
    expect(a).not.toBe(b)
  })

  it.each([
    ['easy', 40],
    ['medium', 32],
    ['hard', 26],
  ])('makes %s puzzles with %i givens and exactly one solution', (_, count) => {
    for (const seed of [1, 2, 3]) {
      const { puzzle, solution } = generatePuzzle(count, seeded(seed))
      expect(givens(puzzle)).toBe(count)
      expect(countSolutions(puzzle)).toBe(1)
      expect(solve(puzzle)).toBe(solution)
      // Every given matches the solution.
      for (let i = 0; i < 81; i++) if (puzzle[i] !== '0') expect(puzzle[i]).toBe(solution[i])
    }
  })

  it('is fast enough to run on every new game', () => {
    const started = performance.now()
    for (let seed = 10; seed < 20; seed++) generatePuzzle(26, seeded(seed))
    const averageMs = (performance.now() - started) / 10
    expect(averageMs).toBeLessThan(200)
  })

  it('refuses impossible targets', () => {
    expect(() => generatePuzzle(10)).toThrow()
  })
})
