import { Link } from 'react-router'
import { Video } from 'lucide-react'
import type { Meeting } from '@app/shared'
import { FullPageSpinner } from '@/components/full-page'
import { CreateMeetingDialog } from '@/components/meetings/create-meeting-dialog'
import { JoinByCodeForm } from '@/components/meetings/join-by-code-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Meetings</h1>
          <p className="text-muted-foreground">
            {isTeacher ? 'Start a live class or reopen a running one.' : 'Join a live class.'}
          </p>
        </div>
        {isTeacher ? <CreateMeetingDialog /> : <JoinByCodeForm />}
      </div>

      {isPending && <FullPageSpinner />}
      {error && <p className="text-destructive">Could not load meetings: {error.message}</p>}

      {meetings && (
        <>
          <MeetingSection title="Live now" meetings={live} empty="No live meetings right now." />
          {isTeacher && past.length > 0 && <MeetingSection title="Past meetings" meetings={past} />}
        </>
      )}
    </div>
  )
}

function MeetingSection(props: { title: string; meetings: Meeting[]; empty?: string }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-medium">{props.title}</h2>
      {props.meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground">{props.empty}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {props.meetings.map(meeting => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </div>
      )}
    </section>
  )
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const live = meeting.status === 'LIVE'
  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle className="flex items-start justify-between gap-2">
          <span className="break-words">{meeting.title}</span>
          <Badge variant={live ? 'default' : 'outline'}>{live ? 'Live' : 'Ended'}</Badge>
        </CardTitle>
        <CardDescription>
          {meeting.teacher.name} · {dateTime.format(new Date(meeting.createdAt))}
        </CardDescription>
        {live && (
          <Button asChild size="sm" className="mt-2 justify-self-start">
            <Link to={`/meetings/${meeting.id}`}>
              <Video /> Join
            </Link>
          </Button>
        )}
      </CardHeader>
    </Card>
  )
}
