import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useNavigate } from 'react-router'
import { signUpSchema, type SignUpInput } from '@app/shared'
import { AuthLayout } from '@/components/auth-layout'
import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import { useCurrentUser, useSignUp } from '@/hooks/use-auth'

/** Self-registration always creates a Student; teacher accounts are provisioned. */
export function SignUpPage() {
  const { user } = useCurrentUser()
  const signUp = useSignUp()
  const navigate = useNavigate()

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  if (user) return <Navigate to="/" replace />

  const onSubmit = form.handleSubmit(values =>
    signUp.mutate(values, { onSuccess: () => navigate('/', { replace: true }) }),
  )

  const { errors } = form.formState

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
        {signUp.error && (
          <p role="alert" className="text-sm text-destructive">
            {signUp.error.message}
          </p>
        )}
        <Button type="submit" disabled={signUp.isPending}>
          {signUp.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  )
}
