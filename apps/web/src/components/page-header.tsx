import type { ReactNode } from 'react'

/** Title, one line of context and an optional action, at the top of each page. */
export function PageHeader(props: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        <h1 className="text-3xl font-bold tracking-tight">{props.title}</h1>
        {props.description && <p className="text-muted-foreground">{props.description}</p>}
      </div>
      {props.action}
    </div>
  )
}
