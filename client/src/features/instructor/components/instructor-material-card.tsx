import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusBadge } from '@/components/ui/custom/status-badge'
import { PdfCard } from '@/features/instructor/components/pdf-card'
import type { InstructorMaterial } from '@/features/instructor/schemas/instructor-material.schema'

const materialDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const statusTones = {
  PROCESSING: 'secondary',
  READY: 'default',
  WARNING: 'outline',
  FAILED: 'destructive',
} as const

export function getInstructorMaterialStatusMessage(
  material: InstructorMaterial,
) {
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

export function InstructorMaterialStatusBadge({
  status,
}: {
  status: InstructorMaterial['status']
}) {
  return (
    <StatusBadge status={status} label={status} tone={statusTones[status]} />
  )
}

export function InstructorMaterialCard({
  material,
}: {
  material: InstructorMaterial
}) {
  const statusMessage = getInstructorMaterialStatusMessage(material)

  return (
    <PdfCard
      title={material.title}
      description={material.originalFilename}
      status={<InstructorMaterialStatusBadge status={material.status} />}
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
    />
  )
}
