import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { DIFFICULTIES, DIFFICULTY_SETTINGS, MAX_MISTAKES, type Difficulty } from '@app/shared'
import { FullPageSpinner } from '@/components/full-page'
import { PageHeader } from '@/components/page-header'
import { formatSeconds } from '@/components/sudoku/game-labels'
import { Button } from '@/components/ui/button'
import { useCurrentGame, useStartGame } from '@/hooks/use-sudoku'

/** Pick a difficulty, or resume the game still in progress. */
export function SudokuPage() {
  const navigate = useNavigate()
  const current = useCurrentGame()
  const start = useStartGame()

  const begin = (difficulty: Difficulty) => {
    if (current.data && !window.confirm('Start a new game? Your current game will end as quit.'))
      return
    start.mutate(difficulty, {
      onSuccess: game => navigate(`/sudoku/${game.id}`),
      onError: error => toast.error(error.message),
    })
  }

  if (current.isPending) return <FullPageSpinner />

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Timed Sudoku"
        description={`Fill the grid before the time runs out. ${MAX_MISTAKES} mistakes end the game. You get a report as soon as it ends.`}
      />

      {current.data && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-l-4 border-l-primary bg-card p-5">
          <div className="grid gap-1">
            <h2 className="font-bold">Game in progress</h2>
            <p className="text-sm text-muted-foreground">
              {DIFFICULTY_SETTINGS[current.data.difficulty].label} ·{' '}
              {formatSeconds(current.data.secondsLeft)} left · {current.data.mistakes} mistakes
            </p>
          </div>
          <Button asChild>
            <Link to={`/sudoku/${current.data.id}`}>Resume</Link>
          </Button>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-3">
        {DIFFICULTIES.map(difficulty => {
          const settings = DIFFICULTY_SETTINGS[difficulty]
          const details = [
            { label: 'Numbers given', value: settings.givens },
            { label: 'Time', value: `${settings.timeLimitS / 60} min` },
            { label: 'Score', value: `×${settings.multiplier}` },
          ]
          return (
            <li key={difficulty} className="flex flex-col gap-5 rounded-xl border bg-card p-5">
              <h2 className="text-xl font-bold">{settings.label}</h2>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                {details.map(detail => (
                  <div key={detail.label} className="grid gap-0.5">
                    <dt className="text-muted-foreground">{detail.label}</dt>
                    <dd className="text-lg font-bold tabular-nums">{detail.value}</dd>
                  </div>
                ))}
              </dl>
              <Button
                variant={current.data ? 'outline' : 'default'}
                className="mt-auto"
                onClick={() => begin(difficulty)}
                disabled={start.isPending}
              >
                Start {settings.label.toLowerCase()}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
