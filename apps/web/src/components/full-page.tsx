import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function FullPageSpinner() {
  return (
    <div
      className="flex min-h-[50svh] items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  )
}

export function FullPageMessage({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[50svh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="max-w-md text-muted-foreground">{description}</p>
      <Button asChild variant="outline">
        <Link to="/">Back to dashboard</Link>
      </Button>
    </div>
  )
}
