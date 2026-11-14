import type { ComponentProps } from 'react'
import type { FieldError } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Label + input + validation message, wired for accessibility:
 * the message is linked with aria-describedby and the input is marked aria-invalid.
 */
export function FormField({
  id,
  label,
  error,
  ...inputProps
}: ComponentProps<typeof Input> & { id: string; label: string; error?: FieldError | undefined }) {
  const errorId = `${id}-error`
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error?.message && (
        <p id={errorId} className="text-sm text-destructive">
          {error.message}
        </p>
      )}
    </div>
  )
}
