import { cn } from '@/lib/utils'

const rowOf = (cell: number) => Math.floor(cell / 9)
const colOf = (cell: number) => cell % 9
const boxOf = (cell: number) => Math.floor(rowOf(cell) / 3) * 3 + Math.floor(colOf(cell) / 3)
const ROWS = [0, 1, 2, 3, 4, 5, 6, 7, 8]

/**
 * A 9×9 grid. Given cells are bold; wrong entries are red. With `onSelect`, cells can be
 * selected, and the selected cell's row, column, box and same digit are highlighted.
 */
export function SudokuGrid({
  puzzle,
  board,
  wrongCells,
  selected = null,
  onSelect,
}: {
  puzzle: string
  board: string
  wrongCells: number[]
  selected?: number | null
  onSelect?: (cell: number) => void
}) {
  const wrong = new Set(wrongCells)
  const selectedDigit = selected === null ? '0' : board[selected]

  return (
    <div
      role="grid"
      aria-label="Sudoku grid"
      className="grid aspect-square w-full max-w-[min(100%,32rem)] grid-cols-9 overflow-hidden rounded-md border-2 border-foreground bg-card"
    >
      {/* Rows are for screen readers only: `contents` keeps the cells on the 9-column grid. */}
      {ROWS.map(row => (
        <div key={row} role="row" className="contents">
          {[...board.slice(row * 9, row * 9 + 9)].map((digit, col) => {
            const cell = row * 9 + col
            const given = puzzle[cell] !== '0'
            const isSelected = cell === selected
            const related =
              selected !== null &&
              !isSelected &&
              (rowOf(cell) === rowOf(selected) ||
                colOf(cell) === colOf(selected) ||
                boxOf(cell) === boxOf(selected))
            const sameDigit = digit !== '0' && digit === selectedDigit && !isSelected

            return (
              <button
                key={cell}
                type="button"
                role="gridcell"
                disabled={!onSelect}
                onClick={() => onSelect?.(cell)}
                aria-label={`Row ${rowOf(cell) + 1}, column ${colOf(cell) + 1}: ${
                  digit === '0' ? 'empty' : digit
                }${given ? ', given' : ''}${wrong.has(cell) ? ', wrong' : ''}`}
                aria-selected={isSelected}
                className={cn(
                  'flex items-center justify-center border-border text-lg tabular-nums select-none sm:text-2xl',
                  'disabled:cursor-default',
                  // Thin lines between cells, thick lines between 3×3 boxes.
                  colOf(cell) !== 8 &&
                    (colOf(cell) % 3 === 2 ? 'border-r-2 border-r-foreground' : 'border-r'),
                  rowOf(cell) !== 8 &&
                    (rowOf(cell) % 3 === 2 ? 'border-b-2 border-b-foreground' : 'border-b'),
                  // Givens bold; the player's entries in blue ink, the usual Sudoku convention.
                  given ? 'font-bold text-foreground' : 'font-medium text-ink',
                  related && 'bg-muted',
                  sameDigit && 'bg-secondary',
                  // The selected cell is marked like a highlighter pen.
                  isSelected && 'bg-highlight text-highlight-foreground',
                  // Wrong entries are red pen.
                  wrong.has(cell) && 'bg-destructive/10 font-bold text-destructive',
                )}
              >
                {digit === '0' ? '' : digit}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
