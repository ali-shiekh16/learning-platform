import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { DIFFICULTIES, DIFFICULTY_SETTINGS, MAX_MISTAKES, type Difficulty } from '@app/shared'
import { FullPageSpinner } from '@/components/full-page'
import { formatSeconds } from '@/components/sudoku/game-labels'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Timed Sudoku</h1>
        <p className="text-muted-foreground">
          Fill the grid before the time runs out. {MAX_MISTAKES} mistakes end the game. You get a
          report as soon as it ends.
        </p>
      </div>

      {current.data && (
        <Card className="border-primary/40">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Game in progress</CardTitle>
              <CardDescription>
                {DIFFICULTY_SETTINGS[current.data.difficulty].label} ·{' '}
                {formatSeconds(current.data.secondsLeft)} left · {current.data.mistakes} mistakes
              </CardDescription>
            </div>
            <Button asChild>
              <Link to={`/sudoku/${current.data.id}`}>Resume</Link>
            </Button>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {DIFFICULTIES.map(difficulty => {
          const settings = DIFFICULTY_SETTINGS[difficulty]
          return (
            <Card key={difficulty}>
              <CardHeader className="gap-3">
                <CardTitle>{settings.label}</CardTitle>
                <CardDescription>
                  {settings.givens} numbers given · {settings.timeLimitS / 60} minutes · score ×
                  {settings.multiplier}
                </CardDescription>
                <Button onClick={() => begin(difficulty)} disabled={start.isPending}>
                  Start {settings.label.toLowerCase()}
                </Button>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
