import { Link } from 'react-router'
import { Video } from 'lucide-react'
import type { Meeting } from '@app/shared'
import { FullPageSpinner } from '@/components/full-page'
import { LiveDot } from '@/components/live-dot'
import { CreateMeetingDialog } from '@/components/meetings/create-meeting-dialog'
import { JoinByCodeForm } from '@/components/meetings/join-by-code-form'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/use-auth'
import { useMeetings } from '@/hooks/use-meetings'

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function MeetingsPage() {
  const { user } = useCurrentUser()
  const { data: meetings, isPending, error } = useMeetings()
  if (!user) return null

  const isTeacher = user.role === 'TEACHER'
  const live = meetings?.filter(m => m.status === 'LIVE') ?? []
  const past = meetings?.filter(m => m.status === 'ENDED') ?? []

  return (
    <div className="grid gap-10">
      <PageHeader
        title="Meetings"
        description={
          isTeacher ? 'Start a live class or reopen a running one.' : 'Join a live class.'
        }
        action={isTeacher ? <CreateMeetingDialog /> : <JoinByCodeForm />}
      />

      {isPending && <FullPageSpinner />}
      {error && <p className="text-destructive">Couldn’t load meetings: {error.message}</p>}

      {meetings && (
        <>
          <section className="grid gap-3" aria-labelledby="live-heading">
            <h2 id="live-heading" className="flex items-center gap-2 text-lg font-bold">
              {live.length > 0 && <LiveDot />}
              Live now
            </h2>
            {live.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                {isTeacher
                  ? 'No class is running. Start a meeting and share its code with your students.'
                  : 'No class is running right now. When your teacher starts one it appears here, or you can join with the code they give you.'}
              </p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {live.map(meeting => (
                  <li key={meeting.id}>
                    <LiveMeetingCard meeting={meeting} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {isTeacher && past.length > 0 && (
            <section className="grid gap-3" aria-labelledby="past-heading">
              <h2 id="past-heading" className="text-lg font-bold">
                Past meetings
              </h2>
              <ul className="divide-y rounded-xl border bg-card">
                {past.map(meeting => (
                  <li
                    key={meeting.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
                  >
                    <span className="font-medium break-words">{meeting.title}</span>
                    <span className="text-sm text-muted-foreground">
                      Ended · {dateTime.format(new Date(meeting.createdAt))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function LiveMeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-l-4 border-l-live bg-card p-5">
      <div className="grid gap-1">
        <h3 className="text-lg leading-snug font-bold break-words">{meeting.title}</h3>
        <p className="text-sm text-muted-foreground">
          {meeting.teacher.name} · started {dateTime.format(new Date(meeting.createdAt))}
        </p>
      </div>
      <Button asChild className="mt-auto self-start">
        <Link to={`/meetings/${meeting.id}`}>
          <Video /> Join class
        </Link>
      </Button>
    </div>
  )
}
