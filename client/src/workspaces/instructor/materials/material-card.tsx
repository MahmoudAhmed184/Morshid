import { Alert, AlertDescription } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { StatusBadge } from '@/components/ui/custom/status-badge'
import { PdfCard } from '@/workspaces/instructor/materials/pdf-card'
import type { Material } from '@/features/materials/material-ingestion/material.schema'

const materialDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const statusTones = {
  PROCESSING: 'info',
  READY: 'success',
  WARNING: 'warning',
  FAILED: 'destructive',
} as const

export function getMaterialStatusMessage(material: Material) {
  if (material.status === 'WARNING') {
    return material.errorMessage ?? 'This material is ready with a warning.'
  }

  if (material.status === 'FAILED') {
    return (
      material.errorMessage ??
      'This material could not be processed. Check the PDF and try again.'
    )
  }

  return null
}

export function MaterialStatusBadge({
  status,
}: {
  status: Material['status']
}) {
  return (
    <StatusBadge status={status} label={status} tone={statusTones[status]} />
  )
}

export function MaterialCard({
  material,
  onDelete,
}: {
  material: Material
  onDelete?: () => Promise<unknown>
}) {
  const statusMessage = getMaterialStatusMessage(material)
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <PdfCard
        title={material.title}
        description={material.originalFilename}
        status={<MaterialStatusBadge status={material.status} />}
        statusKey={material.status}
        details={
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            {material.extractedTextLength !== null ? (
              <div className="flex gap-1">
                <dt>Extracted text:</dt>
                <dd>
                  {material.extractedTextLength.toLocaleString()} characters
                </dd>
              </div>
            ) : null}
            {material.chunkCount !== null ? (
              <div className="flex gap-1">
                <dt>Chunks:</dt>
                <dd>{material.chunkCount.toLocaleString()}</dd>
              </div>
            ) : null}
            <div className="flex gap-1">
              <dt>Updated:</dt>
              <dd>
                {materialDateFormatter.format(new Date(material.updatedAt))}
              </dd>
            </div>
          </dl>
        }
        message={
          statusMessage ? (
            <Alert
              variant={material.status === 'FAILED' ? 'destructive' : 'default'}
            >
              <AlertDescription>{statusMessage}</AlertDescription>
            </Alert>
          ) : null
        }
        actions={
          material.canDelete && onDelete ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2Icon /> Delete material
            </DropdownMenuItem>
          ) : null
        }
      />
      {material.canDelete && onDelete ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`Delete ${material.title}?`}
          description="This material will no longer be available in the course."
          confirmLabel="Delete material"
          onConfirm={async () => {
            await onDelete()
          }}
        />
      ) : null}
    </>
  )
}
