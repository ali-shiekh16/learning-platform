import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { signInSchema, type SignInInput } from '@app/shared'
import { AuthLayout } from '@/components/auth-layout'
import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { useCurrentUser, useSignIn } from '@/hooks/use-auth'
import { safeRedirect } from '@/lib/safe-redirect'

export function SignInPage() {
  const { user } = useCurrentUser()
  const signIn = useSignIn()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirectTo = safeRedirect(params.get('redirect'))

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  if (user) return <Navigate to={redirectTo} replace />

  const onSubmit = form.handleSubmit(values =>
    signIn.mutate(values, { onSuccess: () => navigate(redirectTo, { replace: true }) }),
  )

  const { errors } = form.formState

  return (
    <AuthLayout
      title="Sign in"
      description="Welcome back. Sign in to join meetings and play."
      footer={
        <span>
          New here?{' '}
          <Link
            to="/sign-up"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create a student account
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email}
          {...form.register('email')}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password}
          {...form.register('password')}
        />
        {signIn.error && (
          <p role="alert" className="text-sm text-destructive">
            {signIn.error.message}
          </p>
        )}
        <Button type="submit" disabled={signIn.isPending}>
          {signIn.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
