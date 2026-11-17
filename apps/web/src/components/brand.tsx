import { NotebookPen } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The app's name with its exercise-book mark. */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2 font-bold tracking-tight', className)}>
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <NotebookPen className="size-4" aria-hidden />
      </span>
      Learning Platform
    </span>
  )
}
