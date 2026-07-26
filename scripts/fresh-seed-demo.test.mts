import assert from 'node:assert/strict'
import test from 'node:test'

import { runFreshSeedDemo } from './fresh-seed-demo.mts'

function ignoreOutput(_message: string): void {
  return undefined
}

void test('refuses to start when reset confirmation is missing', () => {
  const commands: string[] = []
  const errors: string[] = []

  const status = runFreshSeedDemo({
    confirmation: undefined,
    runCommand(command, args) {
      commands.push([command, ...args].join(' '))
      return { status: 0 }
    },
    output: {
      log: ignoreOutput,
      error(message) {
        errors.push(message)
      },
    },
  })

  assert.equal(status, 1)
  assert.deepEqual(commands, [])
  assert.match(errors.join('\n'), /MORSHID_RESET_CONFIRM=reset-local/)
})

void test('runs every fresh-seed stage in order and reports success', () => {
  const commands: string[] = []
  const logs: string[] = []

  const status = runFreshSeedDemo({
    confirmation: 'reset-local',
    runCommand(command, args) {
      commands.push([command, ...args].join(' '))
      return { status: 0 }
    },
    output: {
      log(message) {
        logs.push(message)
      },
      error: ignoreOutput,
    },
  })

  assert.equal(status, 0)
  assert.deepEqual(commands, [
    'npm run infra:up',
    'npm run db:reset',
    'npm run db:seed',
    'npm run check',
    'npm run test:e2e --workspace server',
  ])
  assert.match(logs.join('\n'), /Fresh-seed demo gate passed/)
  assert.match(logs.join('\n'), /infrastructure.*left running/i)
  assert.match(logs.join('\n'), /npm run dev/)
})

const failingStages = [
  {
    command: 'npm run infra:up',
    label: 'Start local infrastructure',
    recovery: /check Docker.*npm run infra:up/i,
  },
  {
    command: 'npm run db:reset',
    label: 'Reset the database and apply all migrations',
    recovery: /MORSHID_RESET_CONFIRM=reset-local npm run db:reset/,
  },
  {
    command: 'npm run db:seed',
    label: 'Seed deterministic P0 data',
    recovery: /npm run db:seed/,
  },
  {
    command: 'npm run check',
    label: 'Run repository checks',
    recovery: /npm run check/,
  },
  {
    command: 'npm run test:e2e --workspace server',
    label: 'Run server E2E acceptance tests',
    recovery: /npm run test:e2e --workspace server/,
  },
] as const

for (const failedStage of failingStages) {
  void test(`stops and explains recovery when ${failedStage.command} fails`, () => {
    const commands: string[] = []
    const errors: string[] = []

    const status = runFreshSeedDemo({
      confirmation: 'reset-local',
      runCommand(command, args) {
        const invocation = [command, ...args].join(' ')
        commands.push(invocation)
        return { status: invocation === failedStage.command ? 17 : 0 }
      },
      output: {
        log: ignoreOutput,
        error(message) {
          errors.push(message)
        },
      },
    })

    const failedIndex = commands.indexOf(failedStage.command)
    assert.equal(status, 17)
    assert.equal(failedIndex, commands.length - 1)
    assert.match(errors.join('\n'), new RegExp(failedStage.label, 'i'))
    assert.match(errors.join('\n'), failedStage.recovery)
  })
}

void test('reports a command spawn error as exit code 1', () => {
  const commands: string[] = []
  const errors: string[] = []

  const status = runFreshSeedDemo({
    confirmation: 'reset-local',
    runCommand(command, args) {
      commands.push([command, ...args].join(' '))
      return {
        status: null,
        error: new Error('spawn npm ENOENT'),
      }
    },
    output: {
      log: ignoreOutput,
      error(message) {
        errors.push(message)
      },
    },
  })

  assert.equal(status, 1)
  assert.deepEqual(commands, ['npm run infra:up'])
  assert.match(errors.join('\n'), /Unable to run npm.*spawn npm ENOENT/i)
})

void test('reports signal termination as exit code 1', () => {
  const errors: string[] = []

  const status = runFreshSeedDemo({
    confirmation: 'reset-local',
    runCommand() {
      return { status: null, signal: 'SIGTERM' }
    },
    output: {
      log: ignoreOutput,
      error(message) {
        errors.push(message)
      },
    },
  })

  assert.equal(status, 1)
  assert.match(errors.join('\n'), /terminated by signal SIGTERM/i)
})
