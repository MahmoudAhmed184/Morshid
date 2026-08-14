import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

import {
  assertCatalogSemanticFingerprint,
  catalogSemanticFingerprint,
} from './catalog-semantics.mts'

void test('rejects a same-named CHECK with weaker semantics', () => {
  const reviewed = [
    {
      name: 'messages_sequence_check',
      type: 'c',
      definition: 'CHECK ((sequence > 0))',
    },
  ]
  const weakened = [
    {
      name: 'messages_sequence_check',
      type: 'c',
      definition: 'CHECK (true)',
    },
  ]

  assert.throws(() => {
    assertCatalogSemanticFingerprint(
      catalogSemanticFingerprint(reviewed),
      weakened,
    )
  }, /catalog semantics differ/)
})

void test('canonicalizes object key order without weakening SQL definitions', () => {
  const left = [{ name: 'constraint', definition: 'CHECK (value > 0)' }]
  const reordered = [{ definition: 'CHECK (value > 0)', name: 'constraint' }]
  const changed = [{ name: 'constraint', definition: 'CHECK (value >= 0)' }]

  assert.equal(
    catalogSemanticFingerprint(left),
    catalogSemanticFingerprint(reordered),
  )
  assert.notEqual(
    catalogSemanticFingerprint(left),
    catalogSemanticFingerprint(changed),
  )
})

void test('a same-named weaker CHECK makes semantic verification nonzero', () => {
  const verifierUrl = new URL('./catalog-semantics.mts', import.meta.url).href
  const reviewed = [
    { name: 'messages_sequence_check', definition: 'CHECK ((sequence > 0))' },
  ]
  const weakened = [
    { name: 'messages_sequence_check', definition: 'CHECK (true)' },
  ]
  const expected = catalogSemanticFingerprint(reviewed)
  const proof = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `import { assertCatalogSemanticFingerprint } from ${JSON.stringify(verifierUrl)}; assertCatalogSemanticFingerprint(${JSON.stringify(expected)}, ${JSON.stringify(weakened)})`,
    ],
    { encoding: 'utf8' },
  )

  assert.notEqual(proof.status, 0)
  assert.match(proof.stderr, /catalog semantics differ/)
})
