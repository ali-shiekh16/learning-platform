import { createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/app-shell'
import { FullPageMessage, FullPageSpinner } from '@/components/full-page'
import { RequireAuth } from '@/components/require-auth'
import { RouteError } from '@/components/route-error'
import { DashboardPage } from '@/pages/dashboard-page'
import { MeetingsPage } from '@/pages/meetings-page'
import { ReportPage } from '@/pages/report-page'
import { ReportsPage } from '@/pages/reports-page'
import { SudokuGamePage } from '@/pages/sudoku-game-page'
import { SudokuPage } from '@/pages/sudoku-page'
import { TtsPage } from '@/pages/tts-page'
import { SignInPage } from '@/pages/sign-in-page'
import { SignUpPage } from '@/pages/sign-up-page'

export const router = createBrowserRouter([
  // One error boundary for every route: a crash shows a message instead of a blank page.
  {
    errorElement: <RouteError />,
    children: [
      { path: '/sign-in', element: <SignInPage /> },
      { path: '/sign-up', element: <SignUpPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            // Shown while a lazy route's code downloads.
            hydrateFallbackElement: <FullPageSpinner />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'meetings', element: <MeetingsPage /> },
              { path: 'sudoku', element: <SudokuPage /> },
              { path: 'sudoku/:id', element: <SudokuGamePage /> },
              { path: 'reports', element: <ReportsPage /> },
              { path: 'reports/:id', element: <ReportPage /> },
              { path: 'tools/tts', element: <TtsPage /> },
              {
                path: 'meetings/:id',
                // LiveKit is large: load the room's code only when someone opens a meeting.
                lazy: () =>
                  import('@/pages/meeting-room-page').then(m => ({ Component: m.MeetingRoomPage })),
              },
            ],
          },
        ],
      },
      {
        path: '*',
        element: (
          <FullPageMessage
            title="Page not found"
            description="The page you are looking for does not exist."
          />
        ),
      },
    ],
  },
])
