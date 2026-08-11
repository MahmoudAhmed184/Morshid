import { resolve } from 'node:path'

const testPath =
  '(^|/)(?:test|tests|fixtures|testing)(?:/|$)|\\.(?:test|spec)\\.[^.]+$'

const tsConfigFileName = resolve(
  process.env.DEPCRUISE_TSCONFIG ?? 'client/tsconfig.json',
)

export default {
  forbidden: [
    {
      name: 'no-circular',
      comment:
        'Dependencies must remain acyclic so ownership boundaries stay navigable.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      comment:
        'Every local dependency must resolve from the workspace source tree.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'not-to-test',
      comment:
        'Production code must not depend on test-only, fixture, or testing support code.',
      severity: 'error',
      from: { pathNot: testPath },
      to: { path: testPath },
    },
  ],
  options: {
    tsConfig: { fileName: tsConfigFileName },
    enhancedResolveOptions: {
      conditionNames: ['import', 'types', 'node', 'default'],
      mainFields: ['module', 'main'],
    },
    doNotFollow: {
      path: [
        'node_modules',
        '(^|/)routeTree\\.gen\\.ts$',
        '(^|/)generated/prisma(?:/|$)',
      ],
      dependencyTypes: [
        'npm',
        'npm-dev',
        'npm-optional',
        'npm-peer',
        'npm-bundled',
        'npm-no-pkg',
      ],
    },
  },
}
