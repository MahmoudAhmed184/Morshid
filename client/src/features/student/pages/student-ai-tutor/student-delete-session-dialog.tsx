import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import type { ChatSession } from '@/features/student/schemas/student-chat.schema'

interface StudentDeleteSessionDialogProps {
  session: ChatSession
  open: boolean
  isPending: boolean
  onOpenChange: (open: boolean) => void
  onDelete: () => Promise<void>
}

export function StudentDeleteSessionDialog({
  session,
  open,
  isPending,
  onOpenChange,
  onDelete,
}: StudentDeleteSessionDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete conversation?"
      description={`“${session.title}” and its saved history will be removed from your workspace.`}
      confirmLabel="Delete"
      destructive={false}
      disabled={isPending}
      onConfirm={onDelete}
    />
  )
}
