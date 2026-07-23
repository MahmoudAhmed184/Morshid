import {
  GATE_2_RETRIEVAL_MIN_SIMILARITY,
  GATE_2_RETRIEVAL_TOP_K,
} from '../fixtures/gate-2.fixture'

const ambientRetrievalConfig = {
  minSimilarity: process.env.RETRIEVAL_MIN_SIMILARITY,
  topK: process.env.RETRIEVAL_TOP_K,
}

// AppModule validates and captures process.env while its module graph is
// evaluated. Import this bootstrap before AppModule, then restore immediately
// from the test module body so ambient values cannot alter the Gate 2 proof.
process.env.RETRIEVAL_MIN_SIMILARITY = String(GATE_2_RETRIEVAL_MIN_SIMILARITY)
process.env.RETRIEVAL_TOP_K = String(GATE_2_RETRIEVAL_TOP_K)

export function restoreGate2RetrievalEnvironment(): void {
  restoreEnvironmentVariable(
    'RETRIEVAL_MIN_SIMILARITY',
    ambientRetrievalConfig.minSimilarity,
  )
  restoreEnvironmentVariable('RETRIEVAL_TOP_K', ambientRetrievalConfig.topK)
}

function restoreEnvironmentVariable(
  name: 'RETRIEVAL_MIN_SIMILARITY' | 'RETRIEVAL_TOP_K',
  value: string | undefined,
): void {
  if (value === undefined) {
    if (name === 'RETRIEVAL_MIN_SIMILARITY') {
      delete process.env.RETRIEVAL_MIN_SIMILARITY
    } else {
      delete process.env.RETRIEVAL_TOP_K
    }
    return
  }

  process.env[name] = value
}
