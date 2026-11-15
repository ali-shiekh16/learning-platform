import { Link } from 'react-router'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCurrentUser } from '@/hooks/use-auth'
import type { Role } from '@app/shared'

interface Feature {
  title: string
  description: string
  /** Route of the feature; features without one are not built yet. */
  to?: string
}

const FEATURES: Record<Role, Feature[]> = {
  TEACHER: [
    {
      title: 'Meetings',
      description: 'Start a live class and share the join code.',
      to: '/meetings',
    },
    {
      title: 'Student reports',
      description: 'Sudoku results of students in your classes.',
    },
    {
      title: 'Text to speech',
      description: 'Read any text aloud with a choice of voices.',
    },
  ],
  STUDENT: [
    {
      title: 'Join a meeting',
      description: 'Enter a code or pick a live class.',
      to: '/meetings',
    },
    {
      title: 'Timed Sudoku',
      description: 'Beat the clock and get a performance report.',
    },
    { title: 'My reports', description: 'Your past games and scores.' },
    {
      title: 'Text to speech',
      description: 'Read any text aloud with a choice of voices.',
    },
  ],
}

/** Landing page after sign-in. What it offers depends on the user's role. */
export function DashboardPage() {
  const { user } = useCurrentUser()
  if (!user) return null

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {user.name.split(' ')[0]}</h1>
        <p className="text-muted-foreground">
          {user.role === 'TEACHER'
            ? 'Run live classes and follow your students’ progress.'
            : 'Join your classes and practise with timed Sudoku.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES[user.role].map(feature => {
          const card = (
            <Card
              className={feature.to ? 'h-full transition-colors hover:bg-muted/50' : 'opacity-60'}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  {feature.title}
                  {!feature.to && <Badge variant="outline">Soon</Badge>}
                </CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          )
          return feature.to ? (
            <Link key={feature.title} to={feature.to} className="rounded-xl">
              {card}
            </Link>
          ) : (
            <div key={feature.title}>{card}</div>
          )
        })}
      </div>
    </div>
  )
}
