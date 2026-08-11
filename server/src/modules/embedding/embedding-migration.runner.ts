import type {
  MaterialChunkInput,
  MaterialChunkRepository,
} from '../materials/material-chunk.repository'
import type { EmbeddingProvider } from './embedding-provider'

/**
 * One material the migration may have to re-embed.
 *
 * `title` comes from the material record and is re-supplied to the target
 * provider, because live adapters fold it into the embedded document text.
 */
export interface MigratableMaterial {
  readonly id: string
  readonly title: string
  readonly chunkCount: number | null
}

/**
 * The corpus the runner walks.
 *
 * Deliberately narrow: the runner reads candidate materials and their persisted
 * chunk text, and writes replacements. It never re-extracts a PDF — see
 * `migrateEmbeddings` for why.
 */
export interface EmbeddingMigrationCorpus {
  /**
   * Every candidate material, in a stable order.
   *
   * Candidate is the shared base scope used by readiness: `READY`/`WARNING`,
   * not soft-deleted, with a positive extracted text length. Ordering must be
   * stable so a resumed run walks the same corpus.
   */
  listCandidateMaterials(): Promise<readonly MigratableMaterial[]>

  /** How many of a material's chunks already carry the target profile. */
  countChunksForProfile(
    materialId: string,
    embeddingModel: string,
  ): Promise<number>
}

export interface EmbeddingMigrationOptions {
  readonly target: EmbeddingProvider
  readonly corpus: EmbeddingMigrationCorpus
  readonly persistence: Pick<
    MaterialChunkRepository,
    'findMaterialChunks' | 'replaceMaterialChunks'
  >
  /** Progress reporting only. It must never decide what to skip. */
  readonly report?: (event: EmbeddingMigrationEvent) => void
}

export type EmbeddingMigrationEvent =
  | { kind: 'skipped_complete'; materialId: string; chunkCount: number }
  | { kind: 'migrated'; materialId: string; chunkCount: number }
  | { kind: 'failed'; materialId: string }
  | { kind: 'empty_material'; materialId: string }
  | { kind: 'invalid_chunk_count'; materialId: string }

export interface EmbeddingMigrationSummary {
  readonly targetModel: string
  readonly candidateCount: number
  readonly migratedCount: number
  readonly skippedCount: number
  readonly failedMaterialIds: readonly string[]
  /** True only when every candidate material is completely covered. */
  readonly complete: boolean
}

/**
 * Re-embeds a corpus under a target provider's document profile.
 *
 * Provider-independent: it takes an already-constructed `EmbeddingProvider`, so
 * a provider can register as a migration target in the same phase that wires
 * its adapter, and the runner never has to know which providers exist.
 *
 * **Resumption is driven by database state, not a cursor.** A
 * `lastCompletedMaterialId` cursor is unsafe: if material A fails and B
 * succeeds, the cursor advances past A and a resumed run skips it permanently.
 * Instead every run scans all candidates in a stable order, checks each one's
 * current target-profile coverage, skips the complete ones, and retries every
 * incomplete one. Per-material chunk replacement is already transactional, so
 * rescanning is a sound resume mechanism. Any progress manifest a caller builds
 * from `report` is informational only.
 *
 * **Re-embeds the persisted chunk text and material title — it never
 * re-extracts a PDF.** Re-extraction could change chunk boundaries if the
 * extractor or chunker has evolved since ingest, silently turning a provider
 * migration into an undocumented content migration.
 */
export async function migrateEmbeddings(
  options: EmbeddingMigrationOptions,
): Promise<EmbeddingMigrationSummary> {
  const { target, corpus, persistence } = options
  const report = options.report ?? (() => undefined)
  const targetModel = target.model

  const materials = await corpus.listCandidateMaterials()
  const failedMaterialIds: string[] = []
  let migratedCount = 0
  let skippedCount = 0

  for (const material of materials) {
    try {
      // Strict readiness can never consider a candidate with a null or
      // non-positive chunk_count complete. Re-embedding cannot repair that
      // material metadata, so report it for normal reprocessing instead of
      // exiting zero while retrieval would remain blocked.
      if (material.chunkCount === null || material.chunkCount <= 0) {
        report({ kind: 'invalid_chunk_count', materialId: material.id })
        failedMaterialIds.push(material.id)
        continue
      }

      const covered = await corpus.countChunksForProfile(
        material.id,
        targetModel,
      )
      if (covered >= material.chunkCount) {
        skippedCount += 1
        report({
          kind: 'skipped_complete',
          materialId: material.id,
          chunkCount: covered,
        })
        continue
      }

      const chunks = await persistence.findMaterialChunks(material.id)
      if (chunks.length === 0) {
        // Nothing to re-embed, and nothing this runner can invent: a candidate
        // material with no chunks needs reprocessing, not migration.
        report({ kind: 'empty_material', materialId: material.id })
        failedMaterialIds.push(material.id)
        continue
      }

      // Replacement is transactional per material and the database enforces
      // one row per (material_id, chunk_index), so these are the complete,
      // stable source texts for this material.
      const sourceChunks = chunks
      if (sourceChunks.length < material.chunkCount) {
        report({ kind: 'failed', materialId: material.id })
        failedMaterialIds.push(material.id)
        continue
      }
      const embeddings = await target.embedDocuments(
        sourceChunks.map((chunk) => ({
          text: chunk.content,
          title: material.title,
        })),
      )

      const replacement: MaterialChunkInput[] = sourceChunks.map(
        (chunk, index) => ({
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          embedding: embeddings[index],
          embeddingModel: targetModel,
        }),
      )
      await persistence.replaceMaterialChunks(material.id, replacement)

      // Verify after every replacement rather than only at the end, so a
      // material that silently failed to persist is reported against itself.
      const verified = await corpus.countChunksForProfile(
        material.id,
        targetModel,
      )
      // Verify against the material metadata readiness itself uses. Verifying
      // only replacement.length can report success after migrating a truncated
      // source set while chunk_count still says more chunks should exist.
      if (verified < material.chunkCount) {
        failedMaterialIds.push(material.id)
        report({ kind: 'failed', materialId: material.id })
        continue
      }

      migratedCount += 1
      report({
        kind: 'migrated',
        materialId: material.id,
        chunkCount: replacement.length,
      })
    } catch {
      // One material's failure must not abandon the rest: the next run rescans
      // and retries exactly the materials still incomplete.
      failedMaterialIds.push(material.id)
      report({ kind: 'failed', materialId: material.id })
    }
  }

  return Object.freeze({
    targetModel,
    candidateCount: materials.length,
    migratedCount,
    skippedCount,
    failedMaterialIds: Object.freeze(failedMaterialIds),
    complete: failedMaterialIds.length === 0,
  })
}
