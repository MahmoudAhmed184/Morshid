import { Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import type { MaterialAdministration } from '@/features/materials/material-administration.schema'

export function DeleteAdminMaterialDialog({
  material,
  onDelete,
}: {
  material: MaterialAdministration
  onDelete: () => Promise<void>
}) {
  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${material.title}`}
          className="text-destructive hover:text-destructive"
        >
          <Trash2Icon className="size-4" aria-hidden />
        </Button>
      }
      title={`Delete “${material.title}”?`}
      description="This material will no longer be available to the AI Tutor. Historical answers and citations will remain, with the source shown as unavailable."
      confirmLabel="Delete"
      onConfirm={onDelete}
    />
  )
}
