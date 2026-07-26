import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export interface CommandResult {
  status: number | null
  signal?: NodeJS.Signals | null
  error?: Error
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
) => CommandResult

export interface DemoOutput {
  log(message: string): void
  error(message: string): void
}

export interface FreshSeedDemoOptions {
  confirmation: string | undefined
  runCommand: CommandRunner
  output: DemoOutput
}

const stages = [
  {
    label: 'Start local infrastructure',
    args: ['run', 'infra:up'],
    recovery: 'Check Docker is running, then retry: npm run infra:up',
  },
  {
    label: 'Reset the database and apply all migrations',
    args: ['run', 'db:reset'],
    recovery:
      'Retry the guarded reset: MORSHID_RESET_CONFIRM=reset-local npm run db:reset',
  },
  {
    label: 'Seed deterministic P0 data',
    args: ['run', 'db:seed'],
    recovery: 'Fix the seed failure, then retry: npm run db:seed',
  },
  {
    label: 'Run repository checks',
    args: ['run', 'check'],
    recovery: 'Fix the reported check, then retry: npm run check',
  },
  {
    label: 'Run server E2E acceptance tests',
    args: ['run', 'test:e2e', '--workspace', 'server'],
    recovery:
      'Fix the acceptance failure, then retry: npm run test:e2e --workspace server',
  },
] as const

export function runFreshSeedDemo(options: FreshSeedDemoOptions): number {
  if (options.confirmation !== 'reset-local') {
    options.output.error(
      'Refusing to run the fresh-seed demo gate. Set MORSHID_RESET_CONFIRM=reset-local to continue.',
    )
    return 1
  }

  for (const [index, stage] of stages.entries()) {
    options.output.log(
      `[${String(index + 1)}/${String(stages.length)}] ${stage.label}`,
    )
    const result = options.runCommand('npm', stage.args)

    if (result.status !== 0) {
      if (result.error !== undefined) {
        options.output.error(
          `Unable to run npm ${stage.args.join(' ')}: ${result.error.message}`,
        )
      } else if (result.signal !== undefined && result.signal !== null) {
        options.output.error(
          `npm ${stage.args.join(' ')} was terminated by signal ${result.signal}.`,
        )
      }
      options.output.error(
        `Stage ${String(index + 1)}/${String(stages.length)} failed: ${stage.label}`,
      )
      options.output.error(`Recovery: ${stage.recovery}`)
      options.output.error(
        'After recovery, rerun: MORSHID_RESET_CONFIRM=reset-local npm run demo:fresh-seed',
      )
      return result.status ?? 1
    }
  }

  options.output.log('Fresh-seed demo gate passed:')
  options.output.log(
    '- Database reset, all migrations applied, and deterministic P0 data seeded.',
  )
  options.output.log(
    '- Repository checks and server E2E acceptance tests passed.',
  )
  options.output.log(
    '- Local infrastructure was left running for the demo. Next: npm run dev',
  )

  return 0
}

function runCommand(command: string, args: readonly string[]): CommandResult {
  return spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}

function isMainModule(): boolean {
  return import.meta.url === pathToFileURL(process.argv[1]).href
}

if (isMainModule()) {
  process.exitCode = runFreshSeedDemo({
    confirmation: process.env.MORSHID_RESET_CONFIRM,
    runCommand,
    output: console,
  })
}
