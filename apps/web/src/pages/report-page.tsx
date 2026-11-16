import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { DIFFICULTY_SETTINGS } from '@app/shared'
import { FullPageMessage, FullPageSpinner } from '@/components/full-page'
import { formatSeconds, STATUS_LABEL, STATUS_VARIANT } from '@/components/sudoku/game-labels'
import { SudokuGrid } from '@/components/sudoku/sudoku-grid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useCurrentUser } from '@/hooks/use-auth'
import { useReport } from '@/hooks/use-sudoku'

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** The performance report of one finished game. */
export function ReportPage() {
  const { id = '' } = useParams()
  const { user } = useCurrentUser()
  const report = useReport(id)

  if (report.isPending) return <FullPageSpinner />
  if (report.error)
    return <FullPageMessage title="Can't open this report" description={report.error.message} />

  const r = report.data
  const own = r.student.id === user?.id
  const stats = [
    { label: 'Score', value: r.score },
    { label: 'Correct entries', value: r.correctCount },
    { label: 'Mistakes', value: r.mistakes },
    { label: 'Accuracy', value: `${r.accuracy}%` },
    { label: 'Time', value: formatSeconds(r.durationS) },
  ]

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/reports">
            <ArrowLeft /> Reports
          </Link>
        </Button>
        {own && (
          <Button size="sm" className="ml-auto" asChild>
            <Link to="/sudoku">Play again</Link>
          </Button>
        )}
      </div>

      <div>
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold">
          {own ? 'Your report' : `${r.student.name}’s report`}
          <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
        </h1>
        <p className="text-muted-foreground">
          {DIFFICULTY_SETTINGS[r.difficulty].label} · {dateTime.format(new Date(r.endedAt))}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(stat => (
          <Card key={stat.label} className="py-4">
            <CardContent className="px-4">
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{stat.value}</dd>
            </CardContent>
          </Card>
        ))}
      </dl>

      <section className="grid justify-items-center gap-2">
        <h2 className="justify-self-start font-medium">Final grid</h2>
        <SudokuGrid puzzle={r.puzzle} board={r.board} wrongCells={r.wrongCells} />
        <p className="justify-self-start text-sm text-muted-foreground">
          Bold numbers were given; wrong entries left on the board are in red.
        </p>
      </section>
    </div>
  )
}
