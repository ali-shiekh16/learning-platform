import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useCurrentUser, useRecheckCurrentUser } from '@/hooks/use-auth'
import { SocketProvider } from '@/lib/socket'
import { router } from './router'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
})

/** Connect the real-time socket whenever someone is signed in. */
function RealtimeConnection({ children }: { children: ReactNode }) {
  const { user } = useCurrentUser()
  const recheckUser = useRecheckCurrentUser()
  return (
    <SocketProvider userId={user?.id ?? null} onUnauthenticated={recheckUser}>
      {children}
    </SocketProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RealtimeConnection>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </RealtimeConnection>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  </StrictMode>,
)
