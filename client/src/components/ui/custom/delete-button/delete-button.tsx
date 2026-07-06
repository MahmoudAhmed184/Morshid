import { Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'

type DeleteButtonProps = {
  title: React.ReactNode
  description?: React.ReactNode
  onDelete: () => void | Promise<void>
  confirmValue?: string
  label?: React.ReactNode
  disabled?: boolean
}

/*
Usage:
<DeleteButton
  title="Delete course?"
  description="This cannot be undone."
  confirmValue="DELETE"
  onDelete={deleteCourse}
/>
*/
export function DeleteButton({
  title,
  description,
  onDelete,
  confirmValue,
  label = 'Delete',
  disabled,
}: DeleteButtonProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" disabled={disabled}>
          <Trash2Icon />
          {label}
        </Button>
      }
      title={title}
      description={description}
      confirmLabel="Delete"
      confirmInput={confirmValue ? { value: confirmValue } : undefined}
      onConfirm={onDelete}
    />
  )
}
