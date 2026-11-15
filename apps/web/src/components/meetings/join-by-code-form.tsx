import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router'
import { joinMeetingSchema, JOIN_CODE_LENGTH, type JoinMeetingInput } from '@app/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useJoinMeetingByCode } from '@/hooks/use-meetings'

export function JoinByCodeForm() {
  const joinByCode = useJoinMeetingByCode()
  const navigate = useNavigate()
  const form = useForm<JoinMeetingInput>({
    resolver: zodResolver(joinMeetingSchema),
    defaultValues: { code: '' },
  })

  const onSubmit = form.handleSubmit(({ code }) =>
    joinByCode.mutate(code, { onSuccess: meeting => navigate(`/meetings/${meeting.id}`) }),
  )

  const error = form.formState.errors.code?.message ?? joinByCode.error?.message

  return (
    <form onSubmit={onSubmit} className="grid gap-2" noValidate>
      <Label htmlFor="code">Join with a code</Label>
      <div className="flex gap-2">
        <Input
          id="code"
          placeholder="ABC234"
          maxLength={JOIN_CODE_LENGTH}
          autoComplete="off"
          className="w-36 font-mono tracking-widest uppercase"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'code-error' : undefined}
          {...form.register('code')}
        />
        <Button type="submit" disabled={joinByCode.isPending}>
          {joinByCode.isPending ? 'Joining…' : 'Join'}
        </Button>
      </div>
      {error && (
        <p id="code-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
