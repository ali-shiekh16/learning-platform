import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { signInSchema, type SignInInput } from '@app/shared'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/form-field'
import { authClient } from '@/lib/auth-client'
import { AuthLayout } from './auth-layout'
import { safeRedirect } from './safe-redirect'
import { useCurrentUser, useRefreshCurrentUser } from './use-current-user'

export function SignInPage() {
  const { user } = useCurrentUser()
  const refreshUser = useRefreshCurrentUser()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirectTo = safeRedirect(params.get('redirect'))
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  if (user) return <Navigate to={redirectTo} replace />

  const onSubmit = form.handleSubmit(async values => {
    setServerError(null)
    const { error } = await authClient.signIn.email(values)
    if (error) {
      setServerError(
        error.status === 429
          ? 'Too many attempts. Wait a minute and try again.'
          : 'Incorrect email or password.',
      )
      return
    }
    await refreshUser()
    await navigate(redirectTo, { replace: true })
  })

  const { errors, isSubmitting } = form.formState

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
        {serverError && (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
