import { Link } from 'react-router'
import { Moon, Sun, Volume2 } from 'lucide-react'
import { Brand } from '@/components/brand'
import { LiveDot } from '@/components/live-dot'
import { SudokuGrid } from '@/components/sudoku/sudoku-grid'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'

// A game in progress for the hero: blue-ink entries, one red-pen mistake (the second 5 in
// row 2) and the highlighted cell the student is about to fill.
const SAMPLE = {
  puzzle: '023006789056780023780023000030500001067091000090004567040000910008900045000300600',
  board: '123006789556780123780023006030500801067091030090034567040000910008900045000300600',
  wrongCells: [9],
  selected: 14,
}

const STEPS = [
  {
    title: 'Start a class',
    body: 'The teacher opens a meeting and gets a six-character join code to share with the class.',
  },
  {
    title: 'Teach together',
    body: 'Video, chat and a shared whiteboard in one room. The teacher decides when students can draw, and can mute or remove anyone.',
  },
  {
    title: 'Practise',
    body: 'Students play timed Sudoku at three levels. The server checks every move and keeps the clock.',
  },
  {
    title: 'Read the report',
    body: 'Each game ends with a report: score, accuracy, time and the final grid. Teachers see every student who joined their classes.',
  },
]

const DEMO_ACCOUNTS = [
  { role: 'Teacher', email: 'teacher@demo.test' },
  { role: 'Student', email: 'student@demo.test' },
]

/** The public home page, shown at / to anyone who isn't signed in. */
export function LandingPage() {
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Brand />
          <div className="ml-auto flex items-center gap-2">
            <ThemeButton />
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to="/sign-up">Create an account</Link>
            </Button>
            <Button asChild>
              <Link to="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="ruled-paper border-b">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-[1fr_1.1fr]">
            <div className="grid max-w-xl gap-6">
              <h1 className="text-4xl leading-[1.05] font-bold tracking-tight sm:text-6xl">
                A live classroom, and practice that reports back.
              </h1>
              <p className="text-lg text-muted-foreground">
                Teachers run video lessons with chat and a shared whiteboard. Students join with a
                code, practise timed Sudoku, and every game comes back as a report.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link to="/sign-in">Sign in</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/sign-up">Create a student account</Link>
                </Button>
              </div>
            </div>
            <LessonIllustration />
          </div>
        </section>

        <section aria-labelledby="steps-heading" className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <h2 id="steps-heading" className="text-3xl font-bold tracking-tight">
            How a lesson runs
          </h2>
          <ol className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="grid content-start gap-3 border-t-2 border-ink pt-4">
                <span className="text-sm font-bold text-ink" aria-hidden>
                  {index + 1}
                </span>
                <h3 className="text-xl font-bold">{step.title}</h3>
                <p className="text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-12 flex max-w-2xl items-start gap-3 rounded-lg bg-highlight px-4 py-3 text-highlight-foreground">
            <Volume2 className="mt-0.5 size-5 shrink-0" aria-hidden />
            Anything can be read aloud: chat messages in class, or any text on the read-aloud page,
            with the voices your browser offers.
          </p>
        </section>

        <section aria-labelledby="demo-heading" className="border-t bg-card">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-[1fr_auto] md:items-center">
            <div className="grid gap-2">
              <h2 id="demo-heading" className="text-3xl font-bold tracking-tight">
                Try it with the demo accounts
              </h2>
              <p className="max-w-xl text-muted-foreground">
                Sign in as the teacher in one browser and the student in another (or a private
                window) to see both sides of a class. The password for both is{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                  password123
                </code>
                .
              </p>
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2 md:grid-cols-1">
              {DEMO_ACCOUNTS.map(account => (
                <div
                  key={account.email}
                  className="flex items-center justify-between gap-6 rounded-lg border px-4 py-3"
                >
                  <dt className="font-bold">{account.role}</dt>
                  <dd className="font-mono">{account.email}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground">
          <span>Built with React, Fastify, Socket.IO, LiveKit and Excalidraw.</span>
          <span className="flex gap-4">
            <a href="/api/docs" className="hover:text-foreground">
              API docs
            </a>
            <a
              href="https://github.com/ali-shiekh16/learning-platform"
              className="hover:text-foreground"
            >
              Source on GitHub
            </a>
          </span>
        </div>
      </footer>
    </div>
  )
}

function ThemeButton() {
  const theme = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon-lg"
      onClick={theme.toggle}
      aria-label={theme.toggleLabel}
      title={theme.toggleLabel}
    >
      {theme.dark ? <Sun /> : <Moon />}
    </Button>
  )
}

/**
 * The product drawn with its own parts: a live class on the chalkboard, overlapping a page of
 * the exercise book with a Sudoku in progress. Decorative, so hidden from screen readers.
 */
function LessonIllustration() {
  return (
    <div aria-hidden inert className="relative mx-auto w-full max-w-lg pb-10 lg:max-w-none">
      <div className="chalkboard rounded-xl p-5 shadow-[0_24px_48px_-24px_rgb(27_43_75/0.5)] sm:p-6">
        <div className="flex items-center gap-2 text-xs font-bold text-[#f7a194]">
          <LiveDot /> Live
        </div>
        <p className="mt-1 text-lg font-bold">Fractions, week 3</p>
        <p className="text-xs text-[#aab6af]">
          Join code <span className="font-mono tracking-widest text-[#f2d16b]">7KQ2MX</span>
        </p>
        {/* The board's chalk work stays on the left; the Sudoku page overlaps the right. */}
        <div className="mt-5 flex w-1/2 flex-col items-start gap-3">
          <svg
            viewBox="0 0 100 100"
            className="w-24 sm:w-28"
            fill="none"
            stroke="#eef1ea"
            strokeLinecap="round"
            strokeWidth="2.5"
          >
            {/* A pie cut into quarters with three shaded, drawn as if in chalk. */}
            <path d="M50 50V6a44 44 0 0 1 44 44z" fill="#f2d16b" fillOpacity="0.3" stroke="none" />
            <path d="M50 50h44a44 44 0 0 1-44 44z" fill="#f2d16b" fillOpacity="0.3" stroke="none" />
            <path d="M50 50v44a44 44 0 0 1-44-44z" fill="#f2d16b" fillOpacity="0.3" stroke="none" />
            <circle cx="50" cy="50" r="44" opacity="0.9" />
            <path d="M50 6v88M6 50h88" opacity="0.9" />
          </svg>
          <p className="text-2xl font-bold opacity-90 sm:text-3xl">¾ = 0.75</p>
        </div>
        <div className="mt-6 flex gap-2">
          {['TT', 'SS', 'SA'].map(initials => (
            <span
              key={initials}
              className="flex size-9 items-center justify-center rounded-full bg-[#2f3f38] text-xs font-bold"
            >
              {initials}
            </span>
          ))}
        </div>
      </div>

      {/* The descendant selector shrinks the grid's digits to fit this smaller page. */}
      <div className="absolute right-2 bottom-0 w-[48%] rotate-2 rounded-lg border bg-card p-3 shadow-[0_24px_48px_-20px_rgb(27_43_75/0.45)] sm:-right-4 [&_[role=gridcell]]:text-xs [&_[role=gridcell]]:leading-none sm:[&_[role=gridcell]]:text-base">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-bold">Sudoku · Easy</span>
          <span className="font-mono font-bold text-destructive">0:48</span>
        </div>
        <SudokuGrid
          puzzle={SAMPLE.puzzle}
          board={SAMPLE.board}
          wrongCells={SAMPLE.wrongCells}
          selected={SAMPLE.selected}
        />
      </div>
    </div>
  )
}
