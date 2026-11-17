import type { ReactNode } from 'react'
import { Brand } from '@/components/brand'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/** Centered card on ruled paper, used by the sign-in and sign-up pages. */
export function AuthLayout(props: {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <main className="ruled-paper flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <Brand className="text-lg" />
      <Card className="w-full max-w-sm shadow-[0_1px_0_var(--border),0_12px_32px_-12px_rgb(27_43_75/0.25)]">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl font-bold">{props.title}</h1>
          </CardTitle>
          <CardDescription>{props.description}</CardDescription>
        </CardHeader>
        <CardContent>{props.children}</CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          {props.footer}
        </CardFooter>
      </Card>
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        Live classes with a shared whiteboard, timed Sudoku and reports.
      </p>
    </main>
  )
}
