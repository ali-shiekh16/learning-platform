import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { DIFFICULTY_SETTINGS } from '@app/shared'
import { FullPageMessage, FullPageSpinner } from '@/components/full-page'
import { PageHeader } from '@/components/page-header'
import { formatSeconds, STATUS_CLASS, STATUS_LABEL } from '@/components/sudoku/game-labels'
import { SudokuGrid } from '@/components/sudoku/sudoku-grid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {own ? 'Your report' : `${r.student.name}’s report`}
            <Badge className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</Badge>
          </span>
        }
        description={`${DIFFICULTY_SETTINGS[r.difficulty].label} · ${dateTime.format(new Date(r.endedAt))}`}
      />

      {/* gap-px over a border-coloured background draws the lines between the stats. */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-5">
        {stats.map(stat => (
          <div
            key={stat.label}
            className="grid gap-1 bg-card p-4 last:col-span-2 sm:last:col-span-1"
          >
            <dt className="text-sm text-muted-foreground">{stat.label}</dt>
            <dd className="text-3xl font-bold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section className="grid justify-items-center gap-3">
        <h2 className="justify-self-start text-lg font-bold">Final grid</h2>
        <SudokuGrid puzzle={r.puzzle} board={r.board} wrongCells={r.wrongCells} />
        <p className="justify-self-start text-sm text-muted-foreground">
          Bold numbers were given; wrong entries left on the board are in red.
        </p>
      </section>
    </div>
  )
}
