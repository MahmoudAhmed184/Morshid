import { createHash } from 'node:crypto'

import type { EmbeddingProvider } from './embedding-provider'
import { EMBEDDING_DIMENSIONS } from './embedding-provider'

// Identity, not equality: distinct raw strings that normalize to the same
// text (PDF extraction is noisy about whitespace and Unicode compatibility
// forms such as ligatures and Arabic presentation forms) must embed to the
// same vector. No lowercasing — case folding is locale-sensitive and case can
// be semantically meaningful.
export function normalizeEmbeddingText(text: string): string {
  return text.normalize('NFKC').trim().replace(/\s+/gu, ' ')
}

const BYTES_PER_COMPONENT = 4
const HASH_BYTES = 32
const BLOCK_COUNT = (EMBEDDING_DIMENSIONS * BYTES_PER_COMPONENT) / HASH_BYTES
const MAX_UINT32 = 0xff_ff_ff_ff

// Offline embedding path for CI, local development, and the backup demo: the
// same normalized text always maps to the same unit-norm vector, with no
// network access, API keys, or dependencies beyond node:crypto.
export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly model = 'deterministic-embedding-v1'

  // Hashing runs synchronously on the event loop (~48 SHA-256 digests per
  // text); at P0 ingestion batch sizes this is sub-millisecond per text. If
  // batches grow to thousands of chunks, split them upstream.
  embedBatch(
    texts: readonly string[],
  ): Promise<readonly (readonly number[])[]> {
    return Promise.resolve(texts.map((text) => this.embedText(text)))
  }

  private embedText(text: string): readonly number[] {
    // Seeding with the model name ties every vector to the algorithm version,
    // so bumping `model` changes all vectors instead of silently mixing
    // algorithms under one identifier. NUL is the domain separator between
    // model name and text: it cannot appear in either side after
    // normalization, so the concatenation is unambiguous.
    const seed = createHash('sha256')
      .update(this.model)
      .update('\0')
      .update(normalizeEmbeddingText(text))
      .digest()

    const components = new Array<number>(EMBEDDING_DIMENSIONS)
    const counter = Buffer.alloc(4)
    for (let block = 0; block < BLOCK_COUNT; block += 1) {
      counter.writeUInt32BE(block)
      const bytes = createHash('sha256').update(seed).update(counter).digest()

      for (let offset = 0; offset < HASH_BYTES; offset += BYTES_PER_COMPONENT) {
        const index =
          block * (HASH_BYTES / BYTES_PER_COMPONENT) +
          offset / BYTES_PER_COMPONENT
        components[index] = (bytes.readUInt32BE(offset) / MAX_UINT32) * 2 - 1
      }
    }

    return l2Normalize(components)
  }
}

function l2Normalize(components: number[]): number[] {
  const norm = Math.sqrt(
    components.reduce((sum, component) => sum + component * component, 0),
  )

  // A zero norm requires every SHA-256 draw to land exactly on the midpoint —
  // practically impossible, but the unit-norm invariant must be unconditional.
  if (norm === 0) {
    const basis = new Array<number>(components.length).fill(0)
    basis[0] = 1
    return basis
  }

  return components.map((component) => component / norm)
}
