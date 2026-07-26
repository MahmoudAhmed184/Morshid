import * as fs from 'node:fs'
import { createRequire } from 'node:module'
import * as path from 'node:path'

const require_ = createRequire(__filename)

/**
 * Pins the reason the quota estimate is never reconciled.
 *
 * The adapter debits an estimate before each request and then keeps it — no
 * refund, no reconciliation. That is not a simplification: with the pinned SDK
 * there is no usable Developer-API token count to reconcile *against*.
 * `embedContentResponseFromMldev` — the Developer-API path an API-key client
 * takes — copies only `sdkHttpResponse`, `embeddings`, and `metadata`, and
 * discards `usageMetadata` entirely. The
 * `usageMetadata.promptTokenCount -> statistics.tokenCount` mapping exists only
 * on the Vertex path.
 *
 * `metadata.billableCharacterCount` and `embedding.statistics.tokenCount` are
 * Enterprise-platform fields, not substitutes, and `sdkHttpResponse` is not one
 * either: the body is consumed by `.json()` and that object is reconstructed
 * largely from headers, so no reusable raw body survives.
 *
 * The only valid future reconciliation paths are: upgrade to an SDK that
 * exposes Developer-API embedding usage, call the REST endpoint directly, or
 * add a custom transport that clones the response before SDK conversion. This
 * test exists so an SDK upgrade that changes any of that fails loudly rather
 * than leaving the estimate-only comment quietly wrong.
 */
describe('pinned @google/genai embedding contract', () => {
  const sdkSource = readSdkSource()

  it('pins the SDK version the estimate-only decision was made against', () => {
    // Read off disk rather than `require`d: the package's exports map does not
    // expose its own manifest.
    // Walk up from the resolved entry point: how deep it sits inside the
    // package is a packaging detail that must not break this assertion.
    let directory = path.dirname(require_.resolve('@google/genai'))
    while (!fs.existsSync(path.join(directory, 'package.json'))) {
      directory = path.dirname(directory)
    }
    const manifest = JSON.parse(
      fs.readFileSync(path.join(directory, 'package.json'), 'utf8'),
    ) as { version: string }

    expect(manifest.version).toBe('2.13.0')
  })

  it('verifies that usable Developer-API token metadata remains unavailable', () => {
    const conversion = readFunctionBody(
      sdkSource,
      'function embedContentResponseFromMldev(',
    )

    // If this assertion fails, the Developer-API path started carrying usage
    // data — reconciliation became possible and the adapter's estimate-only
    // accounting should be revisited rather than this test relaxed.
    expect(conversion).not.toContain('usageMetadata')
    expect(conversion).not.toContain('promptTokenCount')
  })

  it('confirms the Vertex path is the only one carrying token counts', () => {
    const conversion = readFunctionBody(
      sdkSource,
      'function embedContentResponseFromVertex(',
    )

    expect(conversion).toContain('tokenCount')
  })
})

function readSdkSource(): string {
  return fs.readFileSync(require_.resolve('@google/genai'), 'utf8')
}

// Reads from the declaration to the next top-level `function`, which is enough
// to isolate one conversion in the SDK's flat bundle.
function readFunctionBody(source: string, declaration: string): string {
  const start = source.indexOf(declaration)
  expect(start).toBeGreaterThanOrEqual(0)

  const next = source.indexOf('\nfunction ', start + declaration.length)
  return source.slice(start, next === -1 ? undefined : next)
}
