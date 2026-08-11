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
    {
      name: 'identity-interface-only',
      comment:
        'Product modules may consume Identity only through its module, request guard, role/public decorators, and identity types.',
      severity: 'error',
      from: {
        path: '^server/src/modules/(?!identity(?:/|$))',
      },
      to: {
        path: '^server/src/modules/identity/(?!identity\\.module\\.ts$|identity\\.guard\\.ts$|identity\\.roles\\.ts$|identity\\.public\\.ts$|identity\\.types\\.ts$)',
      },
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
