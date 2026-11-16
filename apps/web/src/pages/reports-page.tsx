import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { DIFFICULTY_SETTINGS, type ReportListQuery } from '@app/shared'
import { FullPageSpinner } from '@/components/full-page'
import { formatSeconds, STATUS_LABEL, STATUS_VARIANT } from '@/components/sudoku/game-labels'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/use-auth'
import { useReports } from '@/hooks/use-sudoku'

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const selectClass =
  'h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none'

/** Students: their own games. Teachers: a table of their students' games. */
export function ReportsPage() {
  const navigate = useNavigate()
  const { user } = useCurrentUser()
  const isTeacher = user?.role === 'TEACHER'
  const [query, setQuery] = useState<ReportListQuery>({ sort: 'date' })
  const reports = useReports(query)

  if (reports.isPending) return <FullPageSpinner />

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{isTeacher ? 'Student reports' : 'My reports'}</h1>
          <p className="text-muted-foreground">
            {isTeacher
              ? 'Sudoku results of students who attended your meetings.'
              : 'Every game you finished, with its score.'}
          </p>
        </div>
        {!isTeacher && (
          <Button asChild>
            <Link to="/sudoku">Play Sudoku</Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {isTeacher && (
          <label className="grid gap-1 text-sm">
            Student
            <select
              className={selectClass}
              value={query.studentId ?? ''}
              onChange={event =>
                setQuery(q => ({ ...q, studentId: event.target.value || undefined }))
              }
            >
              <option value="">All students</option>
              {reports.data?.students.map(student => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1 text-sm">
          Sort by
          <select
            className={selectClass}
            value={query.sort}
            onChange={event =>
              setQuery(q => ({ ...q, sort: event.target.value as ReportListQuery['sort'] }))
            }
          >
            <option value="date">Newest first</option>
            <option value="score">Highest score</option>
          </select>
        </label>
      </div>

      {reports.error && (
        <p className="text-destructive">Could not load reports: {reports.error.message}</p>
      )}

      {reports.data && reports.data.reports.length === 0 ? (
        <p className="text-muted-foreground">
          {isTeacher
            ? 'No reports yet. They appear when students who joined your meetings play Sudoku.'
            : 'No games yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-background">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                {isTeacher && <th className="px-3 py-2 font-medium">Student</th>}
                <th className="px-3 py-2 font-medium">Difficulty</th>
                <th className="px-3 py-2 font-medium">Result</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
                <th className="px-3 py-2 text-right font-medium">Accuracy</th>
                <th className="px-3 py-2 text-right font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {reports.data?.reports.map(report => (
                <tr
                  key={report.id}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                  onClick={() => navigate(`/reports/${report.id}`)}
                >
                  <td className="px-3 py-2">
                    {/* A real link too, for keyboard and screen-reader users. */}
                    <Link to={`/reports/${report.id}`} className="hover:underline">
                      {dateTime.format(new Date(report.endedAt))}
                    </Link>
                  </td>
                  {isTeacher && <td className="px-3 py-2">{report.student.name}</td>}
                  <td className="px-3 py-2">{DIFFICULTY_SETTINGS[report.difficulty].label}</td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_VARIANT[report.status]}>
                      {STATUS_LABEL[report.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {report.score}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{report.accuracy}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatSeconds(report.durationS)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
