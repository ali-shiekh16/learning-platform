import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { createMeetingSchema, type CreateMeetingInput } from '@app/shared'
import { FormField } from '@/components/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useCreateMeeting } from '@/hooks/use-meetings'

export function CreateMeetingDialog() {
  const [open, setOpen] = useState(false)
  const createMeeting = useCreateMeeting()
  const navigate = useNavigate()
  const form = useForm<CreateMeetingInput>({
    resolver: zodResolver(createMeetingSchema),
    defaultValues: { title: '' },
  })

  const onSubmit = form.handleSubmit(values =>
    createMeeting.mutate(values, {
      onSuccess: meeting => navigate(`/meetings/${meeting.id}`),
    }),
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Start a meeting
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Start a meeting</DialogTitle>
            <DialogDescription>
              Students join with the code shown in the meeting, or from their list of live meetings.
            </DialogDescription>
          </DialogHeader>
          <FormField
            id="title"
            label="Title"
            placeholder="e.g. Fractions, week 3"
            error={form.formState.errors.title}
            {...form.register('title')}
          />
          {createMeeting.error && (
            <p role="alert" className="text-sm text-destructive">
              {createMeeting.error.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={createMeeting.isPending}>
              {createMeeting.isPending ? 'Starting…' : 'Start'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
