import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCurrentUser } from '@/features/auth/use-current-user'
import type { Role } from '@app/shared'

interface Feature {
  title: string
  description: string
  /** Module in which the feature is built; shown until then. */
  available: boolean
}

const FEATURES: Record<Role, Feature[]> = {
  TEACHER: [
    {
      title: 'Meetings',
      description: 'Start a live class and share the join code.',
      available: false,
    },
    {
      title: 'Student reports',
      description: 'Sudoku results of students in your classes.',
      available: false,
    },
    {
      title: 'Text to speech',
      description: 'Read any text aloud with a choice of voices.',
      available: false,
    },
  ],
  STUDENT: [
    {
      title: 'Join a meeting',
      description: 'Enter a code or pick a live class.',
      available: false,
    },
    {
      title: 'Timed Sudoku',
      description: 'Beat the clock and get a performance report.',
      available: false,
    },
    { title: 'My reports', description: 'Your past games and scores.', available: false },
    {
      title: 'Text to speech',
      description: 'Read any text aloud with a choice of voices.',
      available: false,
    },
  ],
}

/** Landing page after sign-in. What it offers depends on the user's role. */
export function DashboardPage() {
  const { user } = useCurrentUser()
  if (!user) return null // RequireAuth guarantees a user; this narrows the type

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
        {FEATURES[user.role].map(feature => (
          <Card key={feature.title} className={feature.available ? '' : 'opacity-60'}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                {feature.title}
                {!feature.available && <Badge variant="outline">Soon</Badge>}
              </CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}
