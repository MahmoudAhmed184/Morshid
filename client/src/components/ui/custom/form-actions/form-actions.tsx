import { Button } from '@/components/ui/button'
import { AsyncButton } from '#/components/ui/custom/async-button'
import { cn } from '@/lib/utils'

type FormActionsProps = {
  onSubmit?: () => void | Promise<void>
  onCancel?: () => void
  submitLabel?: React.ReactNode
  cancelLabel?: React.ReactNode
  isSubmitting?: boolean
  submitDisabled?: boolean
  extra?: React.ReactNode
  className?: string
}

/*
Usage:
<FormActions
  onSubmit={handleSubmit}
  onCancel={() => navigateBack()}
  isSubmitting={mutation.isPending}
/>
*/
export function FormActions({
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  isSubmitting,
  submitDisabled,
  extra,
  className,
}: FormActionsProps) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-end',
        className,
      )}
    >
      {extra ? <div className="mr-auto">{extra}</div> : null}
      {onCancel ? (
        <Button type="button" variant="outline" onClick={onCancel}>
          {cancelLabel}
        </Button>
      ) : null}
      {onSubmit ? (
        <AsyncButton
          type="button"
          onClick={onSubmit}
          isLoading={isSubmitting}
          disabled={submitDisabled}
          loadingText="Saving..."
        >
          {submitLabel}
        </AsyncButton>
      ) : null}
    </div>
  )
}
