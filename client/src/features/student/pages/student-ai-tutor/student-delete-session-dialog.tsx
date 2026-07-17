import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import type { ChatSession } from '@/features/student/schemas/student-chat.schema'

interface StudentDeleteSessionDialogProps {
  session: ChatSession
  isPending: boolean
  onDelete: () => Promise<void>
}

export function StudentDeleteSessionDialog({
  session,
  isPending,
  onDelete,
}: StudentDeleteSessionDialogProps) {
  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={isPending}
          aria-label={`Delete ${session.title}`}
        >
          <Trash2 aria-hidden />
        </Button>
      }
      title="Delete conversation?"
      description={`“${session.title}” and its saved history will be removed from your workspace.`}
      confirmLabel="Delete"
      disabled={isPending}
      onConfirm={onDelete}
    />
  )
}
