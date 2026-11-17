import { Link } from 'react-router'
import { BarChart3, ChevronRight, Grid3x3, Video, Volume2, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { useCurrentUser } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import type { Role } from '@app/shared'

interface Feature {
  title: string
  description: string
  to: string
  icon: LucideIcon
}

const FEATURES: Record<Role, Feature[]> = {
  TEACHER: [
    {
      title: 'Meetings',
      description: 'Start a live class and share the join code.',
      to: '/meetings',
      icon: Video,
    },
    {
      title: 'Student reports',
      description: 'Sudoku results of students in your classes.',
      to: '/reports',
      icon: BarChart3,
    },
    {
      title: 'Text to speech',
      description: 'Read any text aloud with a choice of voices.',
      to: '/tools/tts',
      icon: Volume2,
    },
  ],
  STUDENT: [
    {
      title: 'Join a meeting',
      description: 'Enter a code or pick a live class.',
      to: '/meetings',
      icon: Video,
    },
    {
      title: 'Timed Sudoku',
      description: 'Beat the clock and get a performance report.',
      to: '/sudoku',
      icon: Grid3x3,
    },
    {
      title: 'My reports',
      description: 'Your past games and scores.',
      to: '/reports',
      icon: BarChart3,
    },
    {
      title: 'Text to speech',
      description: 'Read any text aloud with a choice of voices.',
      to: '/tools/tts',
      icon: Volume2,
    },
  ],
}

/** Landing page after sign-in. What it offers depends on the user's role. */
export function DashboardPage() {
  const { user } = useCurrentUser()
  if (!user) return null

  return (
    <div className="grid gap-8">
      <PageHeader
        title={`Welcome, ${user.name.split(' ')[0]}`}
        description={
          user.role === 'TEACHER'
            ? 'Run live classes and follow your students’ progress.'
            : 'Join your classes and practise with timed Sudoku.'
        }
      />

      <ul
        className={cn(
          'grid gap-4 sm:grid-cols-2',
          user.role === 'TEACHER' ? 'lg:grid-cols-3' : 'lg:grid-cols-4',
        )}
      >
        {FEATURES[user.role].map(feature => (
          <li key={feature.title}>
            <Link
              to={feature.to}
              className="group flex h-full flex-col gap-4 rounded-xl border bg-card p-5 text-card-foreground transition-colors hover:border-primary"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                <feature.icon className="size-5" aria-hidden />
              </span>
              <span className="grid gap-1">
                <span className="flex items-center gap-1 font-bold">
                  {feature.title}
                  <ChevronRight
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden
                  />
                </span>
                <span className="text-sm text-muted-foreground">{feature.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
