/**
 * Sudoku solver and generator. Pure functions, no I/O.
 *
 * A grid is an 81-character string read row by row, `0` for an empty cell. Internally
 * the solver uses arrays and bitmasks: for each row, column and 3×3 box, bit d is set
 * when digit d is already used there, so the candidates for a cell are a few bitwise
 * operations instead of scanning 27 cells.
 */

export type Random = () => number

const ALL_DIGITS = 0b1111111110 // bits 1..9

const boxOf = (cell: number) => Math.floor(cell / 27) * 3 + Math.floor((cell % 9) / 3)

const parse = (grid: string) => [...grid].map(Number)
const format = (cells: number[]) => cells.join('')

function shuffle<T>(items: T[], random: Random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

const digitsIn = (mask: number) => {
  const digits: number[] = []
  for (let d = 1; d <= 9; d++) if (mask & (1 << d)) digits.push(d)
  return digits
}

/**
 * Backtracking search. Always fills the empty cell with the fewest candidates first,
 * which keeps the search small. Stops after `limit` solutions; returns how many it found
 * and the first one.
 */
function search(cells: number[], limit: number, random?: Random) {
  const rows = new Array<number>(9).fill(0)
  const cols = new Array<number>(9).fill(0)
  const boxes = new Array<number>(9).fill(0)

  for (let cell = 0; cell < 81; cell++) {
    const digit = cells[cell]!
    if (digit === 0) continue
    const bit = 1 << digit
    const [r, c, b] = [Math.floor(cell / 9), cell % 9, boxOf(cell)]
    // The same digit twice in a row, column or box: no solution.
    if ((rows[r]! | cols[c]! | boxes[b]!) & bit) return { count: 0, first: null }
    rows[r]! |= bit
    cols[c]! |= bit
    boxes[b]! |= bit
  }

  let count = 0
  let first: number[] | null = null

  const step = (): boolean => {
    // Pick the empty cell with the fewest candidates.
    let best = -1
    let bestMask = 0
    let bestCount = 10
    for (let cell = 0; cell < 81; cell++) {
      if (cells[cell] !== 0) continue
      const r = Math.floor(cell / 9)
      const mask = ALL_DIGITS & ~(rows[r]! | cols[cell % 9]! | boxes[boxOf(cell)]!)
      const n = digitsIn(mask).length
      if (n < bestCount) {
        best = cell
        bestMask = mask
        bestCount = n
        if (n <= 1) break
      }
    }

    if (best === -1) {
      count++
      first ??= [...cells]
      return count >= limit // stop once we have enough
    }
    if (bestCount === 0) return false // dead end

    const [r, c, b] = [Math.floor(best / 9), best % 9, boxOf(best)]
    const candidates = random ? shuffle(digitsIn(bestMask), random) : digitsIn(bestMask)
    for (const digit of candidates) {
      const bit = 1 << digit
      cells[best] = digit
      rows[r]! |= bit
      cols[c]! |= bit
      boxes[b]! |= bit
      const done = step()
      cells[best] = 0
      rows[r]! &= ~bit
      cols[c]! &= ~bit
      boxes[b]! &= ~bit
      if (done) return true
    }
    return false
  }

  step()
  return { count, first }
}

/** Number of solutions, counting no further than `limit` (2 answers "is it unique?"). */
export function countSolutions(grid: string, limit = 2): number {
  return search(parse(grid), limit).count
}

/** The solution, or null if the grid has none. */
export function solve(grid: string): string | null {
  const { first } = search(parse(grid), 1)
  return first ? format(first) : null
}

/** True if `grid` is a complete, valid Sudoku solution. */
export function isSolved(grid: string): boolean {
  return /^[1-9]{81}$/.test(grid) && countSolutions(grid, 1) === 1
}

/** A random complete, valid grid. */
export function randomSolution(random: Random = Math.random): string {
  const { first } = search(new Array<number>(81).fill(0), 1, random)
  return format(first!)
}

/**
 * A puzzle with exactly `givens` filled cells and exactly one solution.
 *
 * Fills a random complete grid, then empties cells in random order, keeping each removal
 * only if the puzzle still has a unique solution. A pass can get stuck above the target
 * (every remaining cell is needed for uniqueness); then it starts over with a new grid.
 */
export function generatePuzzle(givens: number, random: Random = Math.random, maxAttempts = 50) {
  if (givens < 17 || givens > 81) throw new Error(`Cannot generate a puzzle with ${givens} givens`)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = randomSolution(random)
    const puzzle = parse(solution)
    let filled = 81

    for (const cell of shuffle([...Array(81).keys()], random)) {
      if (filled === givens) break
      const digit = puzzle[cell]!
      puzzle[cell] = 0
      if (countSolutions(format(puzzle)) === 1) filled--
      else puzzle[cell] = digit
    }

    if (filled === givens) return { puzzle: format(puzzle), solution }
  }
  throw new Error(`Could not generate a puzzle with ${givens} givens`)
}
