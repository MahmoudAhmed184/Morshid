import { resolve } from 'node:path'
import { readdirSync } from 'node:fs'

const testPath =
  '(^|/)(?:test|tests|fixtures|testing)(?:/|$)|\\.(?:test|spec)\\.[^.]+$'

const tsConfigFileName = resolve(
  process.env.DEPCRUISE_TSCONFIG ?? 'client/tsconfig.json',
)

const clientFeatureNames = readdirSync(resolve('client/src/features'), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

const clientFeatureInterfaceRules = clientFeatureNames.map((feature) => ({
  name: `client-${feature}-interface-only`,
  comment: `Client features may consume ${feature} only through its explicit interface files.`,
  severity: 'error',
  from: {
    path: `^client/src/features/(?!${feature}(?:/|$))`,
    pathNot: testPath,
  },
  to: {
    path: `^client/src/features/${feature}(?:/|$)`,
    pathNot:
      feature === 'auth'
        ? '^client/src/features/auth/(?:session/interface|routing/interface)(?:/|$)'
        : feature === 'reviews'
          ? '^client/src/features/reviews/interface(?:/|$)'
          : `^client/src/features/${feature}/interface(?:/|$)`,
  },
}))

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
      name: 'server-common-independent',
      comment:
        'Server common primitives are product-independent and must not import capability modules.',
      severity: 'error',
      from: { path: '^server/src/common(?:/|$)' },
      to: { path: '^server/src/modules(?:/|$)' },
    },
    {
      name: 'server-platform-independent',
      comment:
        'Server platform adapters are product-independent and must not import capability modules.',
      severity: 'error',
      from: { path: '^server/src/platform(?:/|$)' },
      to: { path: '^server/src/modules(?:/|$)' },
    },
    {
      name: 'server-generated-prisma-ownership',
      comment:
        'Generated Prisma types stay at platform, persistence, seed, and persistence-test boundaries; product contracts own domain types.',
      severity: 'error',
      from: {
        path: '^server/src/(?!platform/database(?:/|$)|seeds(?:/|$)|.*(?:\\.repository|repository\\.support|/prisma-)[^/]*\\.ts$)',
      },
      to: { path: '^server/src/generated/prisma(?:/|$)' },
    },
    {
      name: 'server-controller-not-to-persistence-or-controller',
      comment:
        'Controllers depend on application interfaces and DTOs, never persistence adapters or other HTTP adapters.',
      severity: 'error',
      from: {
        path: '^server/src/modules/.+\\.controller\\.ts$',
      },
      to: {
        path: '^server/src/modules/.+(?:\\.repository|\\.controller)\\.ts$',
      },
    },
    {
      name: 'server-persistence-not-to-http-or-application',
      comment:
        'Persistence adapters do not depend on HTTP adapters or application orchestrators.',
      severity: 'error',
      from: { path: '^server/src/modules/.+\\.repository\\.ts$' },
      to: {
        path: '^server/src/modules/.+(?:\\.controller|\\.application|\\.orchestrator)\\.ts$',
      },
    },
    ...clientFeatureInterfaceRules,
    {
      name: 'client-shared-independent',
      comment:
        'Shared client components and libraries must not depend on product composition or ownership modules.',
      severity: 'error',
      from: { path: '^client/src/(?:components|lib)(?:/|$)' },
      to: { path: '^client/src/(?:features|workspaces|routes|app)(?:/|$)' },
    },
    {
      name: 'client-features-not-to-composition',
      comment:
        'Client features own transport, validation, query, and pure domain behavior; role composition belongs to workspaces.',
      severity: 'error',
      from: {
        path: '^client/src/features/(?:[^/]+)(?:/|$)',
        pathNot: testPath,
      },
      to: { path: '^client/src/(?:workspaces|routes|app)(?:/|$)' },
    },
    {
      name: 'client-workspaces-not-to-routes-or-app',
      comment:
        'Role workspaces compose features and shared UI without importing route adapters or app composition.',
      severity: 'error',
      from: { path: '^client/src/workspaces/(?:[^/]+)(?:/|$)' },
      to: { path: '^client/src/(?:routes|app)(?:/|$)' },
    },
    {
      name: 'client-admin-not-to-other-workspaces',
      comment:
        'Admin workspace code must not depend on another role workspace.',
      severity: 'error',
      from: { path: '^client/src/workspaces/admin(?:/|$)' },
      to: { path: '^client/src/workspaces/(?:instructor|student)(?:/|$)' },
    },
    {
      name: 'client-instructor-not-to-other-workspaces',
      comment:
        'Instructor workspace code must not depend on another role workspace.',
      severity: 'error',
      from: { path: '^client/src/workspaces/instructor(?:/|$)' },
      to: { path: '^client/src/workspaces/(?:admin|student)(?:/|$)' },
    },
    {
      name: 'client-student-not-to-other-workspaces',
      comment:
        'Student workspace code must not depend on another role workspace.',
      severity: 'error',
      from: { path: '^client/src/workspaces/student(?:/|$)' },
      to: { path: '^client/src/workspaces/(?:admin|instructor)(?:/|$)' },
    },
    {
      name: 'client-shared-workspace-not-to-role',
      comment:
        'The shared authenticated workspace seam is role-independent and must not import role workspaces.',
      severity: 'error',
      from: { path: '^client/src/workspaces/_shared(?:/|$)' },
      to: {
        path: '^client/src/workspaces/(?:admin|instructor|student)(?:/|$)',
      },
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
    {
      name: 'courses-interface-only',
      comment:
        'Product modules may consume Courses only through its module or course-access interface.',
      severity: 'error',
      from: {
        path: '^server/src/(?:app\\.module\\.ts|common/|modules/(?!courses(?:/|$)))',
        pathNot: testPath,
      },
      to: {
        path: '^server/src/modules/courses/(?!courses\\.module\\.ts$|course-access\\.public\\.ts$|interface/)',
      },
    },
    {
      name: 'materials-interface-only',
      comment:
        'Product modules may consume Materials only through its capability module or named public interface.',
      severity: 'error',
      from: {
        path: '^server/src/(?:app\\.module\\.ts|common/|modules/(?!materials(?:/|$)))',
        pathNot: testPath,
      },
      to: {
        path: '^server/src/modules/materials/(?!materials\\.module\\.ts$|interface/)',
      },
    },
    {
      name: 'audit-interface-only',
      comment:
        'Product modules may consume Audit only through its module or public audit interface.',
      severity: 'error',
      from: {
        path: '^server/src/(?:app\\.module\\.ts|common/|modules/(?!audit(?:/|$)))',
        pathNot: testPath,
      },
      to: {
        path: '^server/src/modules/audit/(?!audit\\.module\\.ts$|audit\\.public\\.ts$)',
      },
    },
    {
      name: 'reviews-interface-only',
      comment:
        'Product modules may consume Reviews only through its module or named public Reviews interface.',
      severity: 'error',
      from: {
        path: '^server/src/(?:app\\.module\\.ts|common/|modules/(?!reviews(?:/|$)))',
        pathNot: testPath,
      },
      to: {
        path: '^server/src/modules/reviews/(?!reviews\\.module\\.ts$|interface/)',
      },
    },
    {
      name: 'conversations-interface-only',
      comment:
        'Product modules may consume Conversations only through its module or named interfaces.',
      severity: 'error',
      from: {
        path: '^server/src/(?:app\\.module\\.ts|common/|modules/(?!conversations(?:/|$)))',
        pathNot: testPath,
      },
      to: {
        path: '^server/src/modules/conversations/(?!conversations\\.module\\.ts$|interface/)',
      },
    },
    {
      name: 'tutoring-interface-only',
      comment:
        'Product modules may consume Tutoring only through its composition module and the runtime command/receipt interface.',
      severity: 'error',
      from: {
        path: '^server/src/(?:app\\.module\\.ts|common/|modules/(?!tutoring(?:/|$)|config/env\\.schema\\.ts$))',
        pathNot: testPath,
      },
      to: {
        path: '^server/src/modules/tutoring/(?!tutoring\\.module\\.ts$|interface/(?:tutoring-runtime\\.ts|run-tutoring-turn-command\\.ts|tutoring-turn-receipt\\.ts)$)',
      },
    },
    {
      name: 'conversations-not-to-tutoring',
      comment:
        'Conversations owns ordered messages and must not depend on Tutoring attempt or workflow internals.',
      severity: 'error',
      from: {
        path: '^server/src/modules/conversations(?:/|$)',
        pathNot: testPath,
      },
      to: {
        path: '^server/src/modules/tutoring(?:/|$)',
      },
    },
    {
      name: 'tutoring-not-to-conversations-http',
      comment:
        'Tutoring owns turn admission and execution; it must not depend on the legacy session HTTP adapter.',
      severity: 'error',
      from: {
        path: '^server/src/modules/tutoring(?:/|$)',
        pathNot: testPath,
      },
      to: {
        path: '^server/src/modules/conversations/conversations-http\.module\.ts$',
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
