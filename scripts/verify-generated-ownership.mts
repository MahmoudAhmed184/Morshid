import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const routeTreePath = resolve(root, 'client/src/routeTree.gen.ts')
const prismaOutputPath = resolve(root, 'server/src/generated/prisma')

await run('npm', ['run', 'generate-routes', '--workspace', 'client'])
await run('npm', ['run', 'db:generate', '--workspace', 'server'])

const prismaFirst = await directoryDigest(prismaOutputPath)

await run('npm', ['run', 'db:generate', '--workspace', 'server'])
const prismaSecond = await directoryDigest(prismaOutputPath)

if (prismaSecond !== prismaFirst) {
  throw new Error(
    'server/src/generated/prisma is not stable under regeneration',
  )
}

// TanStack Start owns the final route-tree output during Vite builds. The
// standalone route generator produces the route modules, while the Start
// plugin adds its registration footer as part of the official build.
await run('npm', ['run', 'build', '--workspace', 'client'])
const routeTreeFirst = await readFile(routeTreePath, 'utf8')

await run('npm', ['run', 'build', '--workspace', 'client'])
const routeTreeSecond = await readFile(routeTreePath, 'utf8')

if (routeTreeSecond !== routeTreeFirst) {
  throw new Error(
    'client/src/routeTree.gen.ts is not stable under regeneration',
  )
}

console.log(
  'generated ownership verified: official route-tree generators and Prisma generator are stable',
)

async function directoryDigest(directory: string): Promise<string> {
  const files = await listFiles(directory)
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(file.slice(directory.length))
    hash.update(await readFile(file))
  }
  return hash.digest('hex')
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)))
    } else {
      files.push(path)
    }
  }
  return files
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: false,
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise()
      } else {
        reject(
          new Error(
            `${command} ${args.join(' ')} exited with ${String(code ?? 'unknown')}`,
          ),
        )
      }
    })
  })
}
