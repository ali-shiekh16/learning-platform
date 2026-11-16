import { isRouteErrorResponse, useRouteError } from 'react-router'
import { FullPageMessage } from '@/components/full-page'
import { Button } from '@/components/ui/button'

/**
 * The router's error boundary: shown instead of a blank screen when a page crashes while
 * rendering, or when a lazily loaded page's code can't be downloaded (e.g. an old tab
 * after a new deployment replaced the files).
 */
export function RouteError() {
  const error = useRouteError()
  console.error(error)

  const failedDownload =
    error instanceof TypeError && /dynamically imported module|import/i.test(error.message)

  return (
    <FullPageMessage
      title={
        isRouteErrorResponse(error) && error.status === 404 ? 'Page not found' : 'Something broke'
      }
      description={
        failedDownload
          ? 'Part of the app could not be downloaded, often because a new version was just released. Reloading fixes it.'
          : 'An unexpected error happened on this page. Reloading usually fixes it.'
      }
      action={
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="outline" onClick={() => window.location.assign('/')}>
            Dashboard
          </Button>
        </div>
      }
    />
  )
}
