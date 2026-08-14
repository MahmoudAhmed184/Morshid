import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import { assertGeneratedOutputMatches } from './generated-ownership.mts'

void test('rejects a hand-edit marker that official generation removes', () => {
  const generated = 'export const routeTree = createRouteTree()\n'
  const handEdited = `// REVIEW_PROOF_HAND_EDIT\n${generated}`

  assert.throws(() => {
    assertGeneratedOutputMatches(
      'client/src/routeTree.gen.ts',
      handEdited,
      generated,
    )
  }, /differs from official generation/)
})

void test('a hand-edit marker makes the ownership verifier process nonzero', () => {
  const verifierUrl = new URL('./generated-ownership.mts', import.meta.url).href
  const generated = 'export const routeTree = createRouteTree()\\n'
  const handEdited = `// REVIEW_PROOF_HAND_EDIT\\n${generated}`
  const proof = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `import { assertGeneratedOutputMatches } from ${JSON.stringify(verifierUrl)}; assertGeneratedOutputMatches('client/src/routeTree.gen.ts', ${JSON.stringify(handEdited)}, ${JSON.stringify(generated)})`,
    ],
    { encoding: 'utf8' },
  )

  assert.notEqual(proof.status, 0)
  assert.match(proof.stderr, /differs from official generation/)
})

void test('accepts output that exactly matches official generation', () => {
  const generated = 'export const routeTree = createRouteTree()\n'

  assert.doesNotThrow(() => {
    assertGeneratedOutputMatches(
      'client/src/routeTree.gen.ts',
      generated,
      generated,
    )
  })
})
