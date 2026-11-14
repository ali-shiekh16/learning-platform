import type { ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/** Centered card used by the sign-in and sign-up pages. */
export function AuthLayout(props: {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{props.title}</CardTitle>
          <CardDescription>{props.description}</CardDescription>
        </CardHeader>
        <CardContent>{props.children}</CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          {props.footer}
        </CardFooter>
      </Card>
    </main>
  )
}
