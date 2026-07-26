import type { InstructorMaterial } from '@/features/instructor/schemas/instructor-material.schema'

const materialStatusBuckets = {
  PROCESSING: 'processing',
  READY: 'ready',
  WARNING: 'attention',
  FAILED: 'attention',
} as const satisfies Record<
  InstructorMaterial['status'],
  'processing' | 'ready' | 'attention'
>

export function summarizeInstructorMaterials(
  materials: readonly InstructorMaterial[],
) {
  return materials.reduce(
    (summary, material) => {
      summary.total += 1
      summary[materialStatusBuckets[material.status]] += 1

      return summary
    },
    { total: 0, processing: 0, ready: 0, attention: 0 },
  )
}
