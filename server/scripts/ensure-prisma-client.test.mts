import assert from 'node:assert/strict'
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { ensurePrismaClient } from './ensure-prisma-client.mts'

interface Fixture {
  readonly cwd: string
  readonly configPath: string
  readonly schemaPath: string
  readonly generatedClientPath: string
}

function createFixture(): Fixture {
  const cwd = mkdtempSync(join(tmpdir(), 'morshid-prisma-client-'))
  mkdirSync(join(cwd, 'prisma'), { recursive: true })
  mkdirSync(join(cwd, 'src', 'generated', 'prisma'), { recursive: true })

  const configPath = join(cwd, 'prisma.config.ts')
  const schemaPath = join(cwd, 'prisma', 'schema.prisma')
  const generatedClientPath = join(
    cwd,
    'src',
    'generated',
    'prisma',
    'client.ts',
  )

  writeFileSync(configPath, "export default { schema: 'prisma' }\n")
  writeFileSync(schemaPath, 'generator client { provider = "prisma-client" }\n')
  writeFileSync(generatedClientPath, 'export class PrismaClient {}\n')

  const sourceTime = new Date(1_000)
  const outputTime = new Date(2_000)
  utimesSync(configPath, sourceTime, sourceTime)
  utimesSync(schemaPath, sourceTime, sourceTime)
  utimesSync(generatedClientPath, outputTime, outputTime)

  return { cwd, configPath, schemaPath, generatedClientPath }
}

function disposeFixture(fixture: Fixture): void {
  rmSync(fixture.cwd, { recursive: true, force: true })
}

void test('skips Prisma generation when every input is older than its output', () => {
  const fixture = createFixture()
  const calls: string[] = []

  try {
    const status = ensurePrismaClient({
      cwd: fixture.cwd,
      runGenerate(cwd) {
        calls.push(cwd)
        return 0
      },
    })

    assert.equal(status, 0)
    assert.deepEqual(calls, [])
  } finally {
    disposeFixture(fixture)
  }
})

void test('generates a missing Prisma client', () => {
  const fixture = createFixture()
  const calls: string[] = []

  try {
    rmSync(fixture.generatedClientPath)

    const status = ensurePrismaClient({
      cwd: fixture.cwd,
      runGenerate(cwd) {
        calls.push(cwd)
        return 0
      },
    })

    assert.equal(status, 0)
    assert.deepEqual(calls, [fixture.cwd])
  } finally {
    disposeFixture(fixture)
  }
})

for (const input of ['configPath', 'schemaPath'] as const) {
  void test(`generates when the Prisma ${input} is newer than its output`, () => {
    const fixture = createFixture()
    const calls: string[] = []

    try {
      const newer = new Date(3_000)
      utimesSync(fixture[input], newer, newer)

      const status = ensurePrismaClient({
        cwd: fixture.cwd,
        runGenerate(cwd) {
          calls.push(cwd)
          return 0
        },
      })

      assert.equal(status, 0)
      assert.deepEqual(calls, [fixture.cwd])
    } finally {
      disposeFixture(fixture)
    }
  })
}

void test('generates when one generated file is older than the inputs', () => {
  const fixture = createFixture()
  const calls: string[] = []

  try {
    const staleGeneratedFile = join(
      fixture.cwd,
      'src',
      'generated',
      'prisma',
      'models.ts',
    )
    writeFileSync(staleGeneratedFile, 'export type User = unknown\n')
    utimesSync(staleGeneratedFile, new Date(500), new Date(500))

    const status = ensurePrismaClient({
      cwd: fixture.cwd,
      runGenerate(cwd) {
        calls.push(cwd)
        return 0
      },
    })

    assert.equal(status, 0)
    assert.deepEqual(calls, [fixture.cwd])
  } finally {
    disposeFixture(fixture)
  }
})

void test('returns the local Prisma generation status', () => {
  const fixture = createFixture()

  try {
    rmSync(fixture.generatedClientPath)

    const status = ensurePrismaClient({
      cwd: fixture.cwd,
      runGenerate() {
        return 17
      },
    })

    assert.equal(status, 17)
  } finally {
    disposeFixture(fixture)
  }
})
