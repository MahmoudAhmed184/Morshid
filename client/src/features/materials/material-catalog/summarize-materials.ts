import type { Material } from '@/features/materials/material-ingestion/material.schema'

const materialStatusBuckets = {
  PROCESSING: 'processing',
  READY: 'ready',
  WARNING: 'attention',
  FAILED: 'attention',
} as const satisfies Record<
  Material['status'],
  'processing' | 'ready' | 'attention'
>

export function summarizeMaterials(materials: readonly Material[]) {
  return materials.reduce(
    (summary, material) => {
      summary.total += 1
      summary[materialStatusBuckets[material.status]] += 1

      return summary
    },
    { total: 0, processing: 0, ready: 0, attention: 0 },
  )
}
