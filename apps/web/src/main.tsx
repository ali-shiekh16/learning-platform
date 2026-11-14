import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { SocketProvider } from '@/lib/socket'
import { router } from './router'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
})

/** Connect the real-time socket whenever someone is signed in. */
function RealtimeConnection({ children }: { children: ReactNode }) {
  const { user } = useCurrentUser()
  return <SocketProvider userId={user?.id ?? null}>{children}</SocketProvider>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RealtimeConnection>
        <RouterProvider router={router} />
      </RealtimeConnection>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  </StrictMode>,
)
