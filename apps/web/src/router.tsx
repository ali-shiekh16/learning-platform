import { createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/app-shell'
import { FullPageMessage } from '@/components/full-page'
import { RequireAuth } from '@/components/require-auth'
import { DashboardPage } from '@/pages/dashboard-page'
import { SignInPage } from '@/pages/sign-in-page'
import { SignUpPage } from '@/pages/sign-up-page'

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
