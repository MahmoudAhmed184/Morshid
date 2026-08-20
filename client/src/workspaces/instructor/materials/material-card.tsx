import { useState } from 'react'
import { Loader2, RotateCcw, Trash2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import { StatusBadge } from '@/components/ui/custom/status-badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Material } from '@/features/materials/material-ingestion/material.schema'
import { PdfCard } from '@/workspaces/instructor/materials/pdf-card'

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
  onRetry,
  isRetrying = false,
  retryError,
}: {
  material: Material
  onDelete?: () => Promise<void>
  onRetry?: () => void
  isRetrying?: boolean
  retryError?: string | null
}) {
  const statusMessage = getMaterialStatusMessage(material)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const canDelete = material.canDelete !== false && onDelete !== undefined
  const canRetry = material.status === 'FAILED' && onRetry !== undefined

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
          statusMessage || retryError ? (
            <Alert
              variant={material.status === 'FAILED' ? 'destructive' : 'default'}
            >
              <AlertDescription>{retryError ?? statusMessage}</AlertDescription>
            </Alert>
          ) : null
        }
        actions={
          canRetry || canDelete ? (
            <>
              {canRetry ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={isRetrying}
                        onClick={onRetry}
                        aria-label={
                          isRetrying
                            ? 'Retrying material processing'
                            : 'Retry material processing'
                        }
                      />
                    }
                  >
                    {isRetrying ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <RotateCcw aria-hidden />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    {isRetrying ? 'Retrying processing...' : 'Retry processing'}
                  </TooltipContent>
                </Tooltip>
              ) : null}
              {canDelete ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteOpen(true)}
                        aria-label="Delete material"
                      />
                    }
                  >
                    <Trash2 aria-hidden />
                  </TooltipTrigger>
                  <TooltipContent>Delete material</TooltipContent>
                </Tooltip>
              ) : null}
            </>
          ) : null
        }
      />
      {canDelete ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`Delete “${material.title}”?`}
          description={
            <>
              This material will no longer be available to the AI Tutor as a
              source. Historical answers will remain, but this source will be
              shown as unavailable.
            </>
          }
          confirmLabel="Delete"
          onConfirm={onDelete}
        />
      ) : null}
    </>
  )
}
