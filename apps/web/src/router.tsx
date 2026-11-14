import { createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/app-shell'
import { FullPageMessage } from '@/components/full-page'
import { RequireAuth } from '@/features/auth/require-auth'
import { SignInPage } from '@/features/auth/sign-in-page'
import { SignUpPage } from '@/features/auth/sign-up-page'
import { DashboardPage } from '@/features/dashboard/dashboard-page'

/**
 * Route map. Everything except sign-in/sign-up sits behind <RequireAuth>.
 * Role-specific routes nest another <RequireAuth roles={[...]}> (added per module).
 */
export const router = createBrowserRouter([
  { path: '/sign-in', element: <SignInPage /> },
  { path: '/sign-up', element: <SignUpPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [{ index: true, element: <DashboardPage /> }],
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
])
