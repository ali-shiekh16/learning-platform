import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { DIFFICULTY_SETTINGS, type ReportListQuery } from '@app/shared'
import { FullPageSpinner } from '@/components/full-page'
import { PageHeader } from '@/components/page-header'
import { formatSeconds, STATUS_CLASS, STATUS_LABEL } from '@/components/sudoku/game-labels'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/use-auth'
import { useReports } from '@/hooks/use-sudoku'

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const selectClass =
  'h-9 rounded-md border border-input bg-card px-3 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/70 focus-visible:outline-none'

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
      <PageHeader
        title={isTeacher ? 'Student reports' : 'My reports'}
        description={
          isTeacher
            ? 'Sudoku results of students who attended your meetings.'
            : 'Every game you finished, with its score.'
        }
        action={
          !isTeacher && (
            <Button asChild>
              <Link to="/sudoku">Play Sudoku</Link>
            </Button>
          )
        }
      />

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
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          {isTeacher
            ? 'No reports yet. They appear when students who joined your meetings play Sudoku.'
            : 'No games yet. Finish a game of Sudoku and its report appears here.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-bold">Date</th>
                {isTeacher && <th className="px-4 py-3 font-bold">Student</th>}
                <th className="px-4 py-3 font-bold">Difficulty</th>
                <th className="px-4 py-3 font-bold">Result</th>
                <th className="px-4 py-3 text-right font-bold">Score</th>
                <th className="px-4 py-3 text-right font-bold">Accuracy</th>
                <th className="px-4 py-3 text-right font-bold">Time</th>
              </tr>
            </thead>
            <tbody>
              {reports.data?.reports.map(report => (
                <tr
                  key={report.id}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
                  onClick={() => navigate(`/reports/${report.id}`)}
                >
                  <td className="px-4 py-3">
                    {/* A real link too, for keyboard and screen-reader users. */}
                    <Link
                      to={`/reports/${report.id}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {dateTime.format(new Date(report.endedAt))}
                    </Link>
                  </td>
                  {isTeacher && <td className="px-4 py-3">{report.student.name}</td>}
                  <td className="px-4 py-3">{DIFFICULTY_SETTINGS[report.difficulty].label}</td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_CLASS[report.status]}>
                      {STATUS_LABEL[report.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{report.score}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{report.accuracy}%</td>
                  <td className="px-4 py-3 text-right tabular-nums">
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
