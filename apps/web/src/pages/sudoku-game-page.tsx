import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Eraser, Flag } from 'lucide-react'
import { toast } from 'sonner'
import { DIFFICULTY_SETTINGS, MAX_MISTAKES, type Game } from '@app/shared'
import { FullPageMessage, FullPageSpinner } from '@/components/full-page'
import { formatSeconds } from '@/components/sudoku/game-labels'
import { SudokuGrid } from '@/components/sudoku/sudoku-grid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCountdown, useFinishGame, useGame, useMove } from '@/hooks/use-sudoku'
import { cn } from '@/lib/utils'

export function SudokuGamePage() {
  const { id = '' } = useParams()
  const game = useGame(id)

  if (game.isPending) return <FullPageSpinner />
  if (game.error)
    return <FullPageMessage title="Can't open this game" description={game.error.message} />
  return <Board game={game.data} receivedAt={game.dataUpdatedAt} />
}

function Board({ game, receivedAt }: { game: Game; receivedAt: number }) {
  const navigate = useNavigate()
  const move = useMove(game.id)
  const finish = useFinishGame(game.id)
  const [selected, setSelected] = useState<number | null>(null)

  const running = game.status === 'IN_PROGRESS'
  const secondsLeft = useCountdown(game.secondsLeft, receivedAt, running)

  // A finished game is shown as its report straight away.
  useEffect(() => {
    if (!running) void navigate(`/reports/${game.id}`, { replace: true })
  }, [running, game.id, navigate])

  // Time's up on screen: ask the server to finalize (it is the one that decides).
  const finishing = useRef(false)
  useEffect(() => {
    if (running && secondsLeft === 0 && !finishing.current) {
      finishing.current = true
      finish.mutate()
    }
  }, [running, secondsLeft, finish])

  const wrong = new Set(game.wrongCells)
  // Givens and correct entries can't change; empty and wrong cells can.
  const editable = (cell: number) =>
    game.puzzle[cell] === '0' && (game.board[cell] === '0' || wrong.has(cell))

  const place = (value: number) => {
    if (selected === null || !editable(selected) || move.isPending || !running) return
    move.mutate(
      { row: Math.floor(selected / 9), col: selected % 9, value },
      {
        onSuccess: ({ correct }) => {
          if (value !== 0 && !correct) toast.error('Not quite: that’s a mistake.')
        },
        onError: error => toast.error(error.message),
      },
    )
  }

  // Keyboard: arrows move, 1–9 place, Backspace/Delete/0 clear.
  const placeRef = useRef(place)
  useEffect(() => {
    placeRef.current = place
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey) return
      const step = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[event.key]
      if (step !== undefined) {
        event.preventDefault()
        setSelected(cell => {
          if (cell === null) return 0
          const next = cell + step
          // Left/right stay on the same row; up/down stay on the board.
          if (Math.abs(step) === 1 && Math.floor(next / 9) !== Math.floor(cell / 9)) return cell
          return next >= 0 && next < 81 ? next : cell
        })
      } else if (/^[1-9]$/.test(event.key)) placeRef.current(Number(event.key))
      else if (['Backspace', 'Delete', '0'].includes(event.key)) placeRef.current(0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const quit = () => {
    if (!window.confirm('Quit this game? It will count as finished.')) return
    finish.mutate(undefined, { onError: error => toast.error(error.message) })
  }

  const settings = DIFFICULTY_SETTINGS[game.difficulty]
  const lowTime = secondsLeft < 60

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Sudoku</h1>
        <Badge variant="outline">{settings.label}</Badge>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span aria-live="polite">
            Mistakes{' '}
            <strong className={cn(game.mistakes > 0 && 'text-destructive')}>
              {game.mistakes}/{MAX_MISTAKES}
            </strong>
          </span>
          <span
            role="timer"
            aria-label={`${formatSeconds(secondsLeft)} left`}
            className={cn(
              'rounded-md bg-muted px-2 py-1 font-mono text-lg tabular-nums',
              lowTime && 'bg-destructive/10 font-semibold text-destructive',
            )}
          >
            {formatSeconds(secondsLeft)}
          </span>
          <Button variant="outline" size="sm" onClick={quit} disabled={finish.isPending}>
            <Flag /> Quit
          </Button>
        </div>
      </header>

      <div className="grid justify-items-center gap-4 md:grid-cols-[1fr_auto] md:items-start">
        <SudokuGrid
          puzzle={game.puzzle}
          board={game.board}
          wrongCells={game.wrongCells}
          selected={selected}
          onSelect={setSelected}
        />

        <div className="grid w-full max-w-xs gap-2">
          <div className="grid grid-cols-5 gap-2 md:grid-cols-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
              <Button
                key={digit}
                variant="outline"
                className="h-12 text-xl"
                onClick={() => place(digit)}
                disabled={move.isPending}
              >
                {digit}
              </Button>
            ))}
            <Button
              variant="outline"
              className="h-12 md:col-span-3"
              onClick={() => place(0)}
              disabled={move.isPending}
              aria-label="Clear cell"
            >
              <Eraser /> <span className="hidden md:inline">Clear</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Select a cell, then type 1–9 or use the pad. Arrow keys move; Backspace clears a wrong
            entry. {MAX_MISTAKES} mistakes end the game.
          </p>
        </div>
      </div>
    </div>
  )
}
