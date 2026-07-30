import { readFileSync, readdirSync, type Dirent } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const serverRoot = process.cwd()
const repositoryRoot = resolve(serverRoot, '..')
const serverSourceRoot = join(serverRoot, 'src')
const tutorSourceRoot = join(serverSourceRoot, 'modules', 'tutor')

const PROHIBITED_PRODUCTION_DEPENDENCIES = new Set([
  'isolated-vm',
  'pyodide',
  'python-shell',
  'vm2',
])

const PROHIBITED_RUNTIME_MODULES = new Set([
  'child_process',
  'isolated-vm',
  'node:child_process',
  'node:vm',
  'pyodide',
  'python-shell',
  'vm',
  'vm2',
])

const TUTOR_EXECUTION_PATTERNS = [
  {
    label: 'dynamic module import',
    pattern: /\bimport\s*\(/u,
  },
  {
    label: 'JavaScript eval',
    pattern: /(?<![.\w])eval\s*\(/u,
  },
  {
    label: 'process execution call',
    pattern: /(?<![.\w])(?:exec|execFile|fork|spawn)\s*\(/u,
  },
  {
    label: 'package installation command',
    pattern: /\b(?:npm|pip|pip3|python|python3)\s+install\b/iu,
  },
  {
    label: 'Docker execution command',
    pattern: /\bdocker\s+(?:build|exec|run)\b/iu,
  },
] as const

describe('Student-code no-execution architecture', () => {
  const productionSourceFiles =
    collectProductionTypeScriptFiles(serverSourceRoot)
  const tutorSourceFiles = collectProductionTypeScriptFiles(tutorSourceRoot)

  it('has no Student-code execution package in production dependencies', () => {
    const manifests = [
      join(repositoryRoot, 'package.json'),
      join(serverRoot, 'package.json'),
    ]

    for (const manifestPath of manifests) {
      const dependencyNames = readProductionDependencyNames(manifestPath)
      expect({
        manifest: relative(repositoryRoot, manifestPath),
        prohibited: dependencyNames.filter((dependency) =>
          PROHIBITED_PRODUCTION_DEPENDENCIES.has(dependency.toLowerCase()),
        ),
      }).toEqual({
        manifest: relative(repositoryRoot, manifestPath),
        prohibited: [],
      })
    }
  })

  it('imports no process, VM, interpreter, or sandbox runtime in production source', () => {
    const prohibitedImports = productionSourceFiles.flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8')
      return extractModuleSpecifiers(source)
        .filter((specifier) => PROHIBITED_RUNTIME_MODULES.has(specifier))
        .map((specifier) => ({
          file: relative(repositoryRoot, filePath),
          specifier,
        }))
    })

    expect(prohibitedImports).toEqual([])
  })

  it('contains no execution, package-install, or dynamic-import path in Tutor production code', () => {
    const matches = tutorSourceFiles.flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8')
      return TUTOR_EXECUTION_PATTERNS.flatMap(({ label, pattern }) =>
        pattern.test(source)
          ? [{ file: relative(repositoryRoot, filePath), label }]
          : [],
      )
    })

    expect(matches).toEqual([])
  })

  it('adds no second NestJS controller, service, classifier, or orchestrator', () => {
    const forbiddenArchitecture = tutorSourceFiles.flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8')
      const declarations = [
        ['NestJS controller', /@Controller\s*\(/u],
        ['NestJS service', /@Injectable\s*\(/u],
        ['parallel classifier', /\bclass\s+\w*Classifier\b/u],
        ['parallel orchestrator', /\bclass\s+\w*Orchestrator\b/u],
      ] as const

      return declarations.flatMap(([label, pattern]) =>
        pattern.test(source)
          ? [{ file: relative(repositoryRoot, filePath), label }]
          : [],
      )
    })

    expect(forbiddenArchitecture).toEqual([])
  })
})

function collectProductionTypeScriptFiles(
  directory: string,
): readonly string[] {
  const files: string[] = []
  const entries = readdirSync(directory, { withFileTypes: true }).sort(
    (left, right) => left.name.localeCompare(right.name),
  )

  for (const entry of entries) {
    if (entry.name === 'generated') {
      continue
    }

    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectProductionTypeScriptFiles(path))
      continue
    }
    if (isProductionTypeScriptFile(entry)) {
      files.push(path)
    }
  }

  return files
}

function isProductionTypeScriptFile(entry: Dirent): boolean {
  return (
    entry.isFile() &&
    entry.name.endsWith('.ts') &&
    !entry.name.endsWith('.spec.ts') &&
    !entry.name.endsWith('.test.ts')
  )
}

function readProductionDependencyNames(
  manifestPath: string,
): readonly string[] {
  const parsed: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (!isRecord(parsed)) {
    throw new TypeError('Package manifest must be an object')
  }

  return ['dependencies', 'optionalDependencies'].flatMap((section) => {
    const dependencies = Reflect.get(parsed, section)
    if (dependencies === undefined) {
      return []
    }
    if (!isRecord(dependencies)) {
      throw new TypeError(`Package manifest ${section} must be an object`)
    }
    return Object.keys(dependencies)
  })
}

function extractModuleSpecifiers(source: string): readonly string[] {
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/gu,
    /\bimport\s+['"]([^'"]+)['"]/gu,
    /\bimport\s*\(\s*['"]([^'"]+)['"]/gu,
    /\brequire\s*\(\s*['"]([^'"]+)['"]/gu,
  ] as const
  const specifiers: string[] = []

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1])
    }
  }

  return specifiers
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
