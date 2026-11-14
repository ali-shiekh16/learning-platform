import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useNavigate } from 'react-router'
import { signUpSchema, type SignUpInput } from '@app/shared'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/form-field'
import { authClient } from '@/lib/auth-client'
import { AuthLayout } from './auth-layout'
import { useCurrentUser, useRefreshCurrentUser } from './use-current-user'

/** Self-registration always creates a Student; teacher accounts are provisioned. */
export function SignUpPage() {
  const { user } = useCurrentUser()
  const refreshUser = useRefreshCurrentUser()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  if (user) return <Navigate to="/" replace />

  const onSubmit = form.handleSubmit(async values => {
    setServerError(null)
    const { error } = await authClient.signUp.email(values)
    if (error) {
      setServerError(
        error.code === 'USER_ALREADY_EXISTS' || error.status === 422
          ? 'An account with this email already exists.'
          : error.status === 429
            ? 'Too many attempts. Wait a minute and try again.'
            : 'Could not create the account. Please try again.',
      )
      return
    }
    await refreshUser()
    await navigate('/', { replace: true })
  })

  const { errors, isSubmitting } = form.formState

  return (
    <AuthLayout
      title="Create a student account"
      description="Teachers receive their accounts from the school."
      footer={
        <span>
          Already have an account?{' '}
          <Link
            to="/sign-in"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormField
          id="name"
          label="Full name"
          autoComplete="name"
          error={errors.name}
          {...form.register('name')}
        />
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
          autoComplete="new-password"
          error={errors.password}
          {...form.register('password')}
        />
        {serverError && (
          <p role="alert" className="text-sm text-destructive">
            {serverError}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  )
}
