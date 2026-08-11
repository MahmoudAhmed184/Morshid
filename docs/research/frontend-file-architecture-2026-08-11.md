# Frontend file architecture research (2026-08-11)

**Research date:** 2026-08-11  
**Scope:** `client/` and root Playwright acceptance tests  
**Status:** Planning evidence only; no refactor is included

## Executive recommendation

Keep Morshid's feature-first frontend, but make large features deeper by business
capability rather than applying “one folder per source file” everywhere.

The recommended shape is:

1. `src/routes/` remains the TanStack-owned URL and route-configuration layer.
   Route files should be thin adapters into feature code.
2. `src/features/<feature>/<capability>/` becomes the main ownership boundary for
   product code. For example, split the broad `student` feature into cohesive
   capabilities such as `chat`, `sessions`, `courses`, `reviews`, and `shell`.
3. Within a capability, use role folders only when they improve navigation:
   `api/`, `queries/`, `hooks/`, `components/`, `schemas/`, `domain/`, and
   `testing/`. Do not invent a generic frontend `services/` layer for code that
   is more precisely an API client, query definition, hook, or pure domain
   function.
4. Keep unit and component tests next to the implementation or cohesive group
   they test. Keep cross-feature browser journeys in `tests/acceptance/`.
5. Do **not** require a dedicated directory for every implementation/test pair.
   Use a named directory when a unit has at least one additional private
   companion (fixtures, child components, styles, types, stories, adapters), or
   when the unit is large enough to need its own internal namespace.
6. Pick one source alias. For this repository, `@/*` is the lowest-churn choice;
   migrate the two observed `#/*` imports and then remove the duplicate alias if
   repository-wide checks confirm nothing else consumes it.
7. Make dependency direction executable with lint rules. Folder names without
   import constraints are only a diagram.

This is not an official TanStack or React-mandated folder tree. The official
sources define routing, environment, testing, and resolution constraints, but
they deliberately do not prescribe one universal application structure. The
specific Morshid structure above is an inference from those constraints, the
repository's current seams, and the colocation principle.

## What the current repository says

The frontend already has a sound foundation:

- `client/` is an npm workspace and a TanStack Start/Vite 8 application.
- Product code is already feature-first under `client/src/features/`; shared UI
  and infrastructure live under `components/`, `lib/`, `providers/`, and
  `hooks/`.
- A local snapshot found 208 TypeScript/TSX files under `features/`, including
  56 test files. Most unit and component tests are already adjacent to their
  implementation.
- The largest feature areas are broad horizontal buckets. `student/pages`
  contains 21 files; `student/data` contains 12; `instructor/components`
  contains 16; and `admin/components` contains 16. Those counts are signals to
  consider capability slices, not automatic proof that every file needs a
  directory.
- The data layer already distinguishes transport (`*.api.ts`), TanStack Query
  definitions (`*.queries.ts`), React hooks, schemas, and pure domain code. A
  new catch-all `services/` directory would discard useful vocabulary.
- There are 21 route files. The tree currently mixes flat pathless student
  routes with directory routes for admin and instructor. TanStack Router
  explicitly supports mixed flat and directory routing, so this is not a
  framework violation.
- `routeTree.gen.ts` identifies itself as generated; it is excluded from ESLint
  and Prettier. That matches TanStack's generated-tree contract and the
  repository instruction not to hand-edit it.
- The client defines both `@/*` and `#/*` for the same `src/*` target. Most code
  uses `@/*`; two observed imports use `#/*`. Two spellings for one boundary add
  choice without adding architecture.
- Cross-feature imports are currently deep and unconstrained. Notifications,
  for example, reaches into student components, API modules, schemas, and error
  types. Also, `import/no-cycle` is disabled. A file-moving exercise that leaves
  this graph unchanged would improve aesthetics more than architecture.

## What first-party sources actually establish

| Evidence | Architectural consequence for Morshid |
| --- | --- |
| TanStack Start places file routes in `src/routes`, generates `routeTree.gen.ts`, and automatically updates generated route paths. It uses file routing for type safety and code splitting. [TanStack Start routing](https://tanstack.com/start/latest/docs/framework/react/guide/routing) | Preserve `routes/` as framework infrastructure and never hand-edit the generated tree. Treat route filenames as framework API, not as ordinary feature filenames. |
| TanStack Router recommends file-based routing, allows flat, directory, and mixed trees, and says a fully flat or fully directory tree is unlikely to fit every project. [File-based routing](https://tanstack.com/router/latest/docs/routing/file-based-routing) | Do not convert every route solely for visual uniformity. Use directories for wide/deep URL branches and flat files where they remain easier to scan. |
| A `-` prefix excludes a route file or folder from route generation and exists specifically to allow colocated route logic. [File naming conventions](https://tanstack.com/router/latest/docs/routing/file-naming-conventions) | Route-specific helpers or tests may live beside a route only when named with the ignore convention. General feature code should still live under `features/`. |
| TanStack distinguishes critical route configuration (search validation, loaders, `beforeLoad`, context) from lazy configuration (components and route UI states). [Router code splitting](https://tanstack.com/router/latest/docs/guide/code-splitting) | Keep route modules focused on route concerns and import page/UI implementations from the owning feature. Avoid broad feature barrels that accidentally couple unrelated pages to a route chunk. |
| TanStack Start's Vite 8 guidance requires enabling `resolve.tsconfigPaths` when a TypeScript path alias is used. [Path aliases](https://tanstack.com/start/latest/docs/framework/react/guide/path-aliases) | The current Vite configuration correctly enables TypeScript aliases. Keep one alias definition as the source of truth and verify build/runtime resolution after changing it. |
| TypeScript warns that `paths` changes TypeScript lookup only; it does not rewrite emitted imports. [TSConfig `paths`](https://www.typescriptlang.org/tsconfig/paths.html) | An alias is not a boundary by itself, and it must agree with Vite/runtime resolution. Do not add multiple aliases to simulate architecture. |
| TanStack Start has client/server import protection and recognizes `*.server.*`, `*.client.*`, and marker imports. Production builds fail on protected cross-environment imports. [Import protection](https://tanstack.com/start/latest/docs/framework/react/guide/import-protection) | If Start-side server functions are introduced later, encode the environment in filenames/markers. Folder organization must not blur browser, universal, and server-only code. |
| React says custom Hooks should express focused, concrete high-level use cases and that their exact boundaries are an application choice. [Reusing logic with custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) React also requires components and Hooks to remain pure. [Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure) | Create hooks around product use cases, not merely to empty a component file. Keep transport and other side effects outside render; a `hooks/` directory is a semantic category, not a dumping ground. |
| TanStack Query recommends colocating a query key and query function through `queryOptions`, so the same typed options can be reused. [Query options](https://tanstack.com/query/latest/docs/react/guides/query-options) | Keep `*.queries.ts` close to their capability's API contract. Do not separate query keys, fetch functions, and options into distant global folders. |
| Vitest discovers `*.test.*` and `*.spec.*` recursively and explicitly says either adjacent tests or a test directory works; there is no single required placement. [Writing tests](https://vitest.dev/guide/learn/writing-tests.html) | The test runner provides no justification for one directory per implementation/test pair. Choose placement based on ownership and change cohesion. |
| Testing Library prioritizes tests that resemble user behavior and avoid implementation details. [Introduction](https://testing-library.com/docs/) Its query priority starts with accessible queries such as role and label. [About queries](https://testing-library.com/docs/queries/about/) | Organize component tests around observable behavior. File placement should not encourage one brittle test for every private helper or child component. |
| Playwright recommends user-visible behavior and isolated tests. [Best practices](https://playwright.dev/docs/best-practices) It supports a configured recursive `testDir`, and page objects/fixtures are optional tools for maintaining larger suites. [Configuration](https://playwright.dev/docs/test-configuration), [page objects](https://playwright.dev/docs/pom), [fixtures](https://playwright.dev/docs/test-fixtures) | Keep acceptance specs at the repository boundary and group them by user journey. Put shared browser setup in `tests/acceptance/support/`; introduce page/flow objects only after real repetition appears. |
| npm workspaces define package-level units and run scripts in workspace context. [npm 11 workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/) TypeScript project references can enforce logical partitions but add composite-build/declaration requirements. [Project references](https://www.typescriptlang.org/docs/handbook/project-references) | A folder under `features/` is not a package boundary. Extract another workspace or TS project only for a genuinely independent unit with a stable API, not to make the tree look modular. |
| ESLint's `no-restricted-imports` supports exact paths and glob/regex patterns. [ESLint rule](https://eslint.org/docs/latest/rules/no-restricted-imports) | Enforce forbidden dependency directions and private cross-feature deep imports in CI rather than relying on reviewer memory. |

Kent C. Dodds's first-person colocation guidance supplies the relevant expert
opinion beyond the official constraints: keep items that change together as
close as reasonable, colocate unit tests with the file or group they test, and
keep E2E tests at the project boundary because they should survive internal
file moves. [Colocation](https://kentcdodds.com/blog/colocation). That supports
Morshid's existing adjacent tests, but it does **not** require wrapping every
pair in another directory.

## Proposed frontend vocabulary

Use names that state a module's role:

| Folder or suffix | Owns | Does not own |
| --- | --- | --- |
| `routes/` | URL mapping, search/param validation, loader and `beforeLoad` wiring, route error/pending choices | General page composition, reusable feature UI, generic helpers |
| `features/<feature>/<capability>/api/` | HTTP transport and response boundary parsing for one capability | React state, query caching, page composition |
| `queries/` | Query keys and reusable `queryOptions`/mutation option definitions | Raw transport implementation or visual state |
| `hooks/` | Focused React orchestration for a named user/product use case | Unrelated utilities or a synonym for “service” |
| `components/` | Capability UI and its private presentational pieces | Cross-product design-system primitives |
| `pages/` | Route-level feature composition when a distinct page concept is useful | TanStack route declarations |
| `schemas/` | Runtime validation schemas and inferred boundary types | Arbitrary UI-only props or a global type warehouse |
| `domain/` | Pure business rules, transformations, and domain types | Fetching, browser state, React rendering |
| `testing/` | Fixtures/builders/render helpers shared by several tests in that capability | A mirror of production folders or helpers used by only one test |
| `components/ui/` | Product-wide UI primitives/design-system components | Feature-specific components |
| `lib/` | Small, product-wide infrastructure such as HTTP/query configuration | Business logic that belongs to a feature |

On the frontend, reserve the word “service” for an actual long-lived interface
that hides a meaningful subsystem. An HTTP function is clearer in `api/`; a
TanStack Query definition is clearer in `queries/`; a React orchestration unit
is clearer as a named hook; and a pure rule belongs in `domain/`. Grouping all
four as “services” makes dependencies harder to see.

## Recommended target shape

This is an illustrative ownership map, not a mandate to create every empty
folder:

```text
client/src/
├── routes/                         # URL tree only
│   ├── __root.tsx
│   ├── admin/
│   ├── instructor/
│   └── _student...
├── features/
│   ├── auth/
│   │   ├── session/                # create when it owns a cohesive group
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── schemas/
│   │   └── routing/
│   ├── student/
│   │   ├── chat/
│   │   │   ├── api/
│   │   │   ├── queries/
│   │   │   ├── hooks/
│   │   │   ├── components/
│   │   │   ├── schemas/
│   │   │   └── testing/
│   │   ├── sessions/
│   │   ├── courses/
│   │   ├── reviews/
│   │   └── shell/
│   ├── instructor/
│   ├── admin/
│   ├── notifications/
│   └── landing/
├── components/
│   ├── ui/                         # shared UI primitives
│   └── layout/                     # genuinely cross-feature layout
├── lib/                            # shared infrastructure
├── providers/
└── test/                           # client-wide Vitest setup only

tests/acceptance/                   # full-stack user journeys
└── support/                        # cross-journey fixtures/helpers
```

Do not force every feature to have the same empty taxonomy. A small `status`
feature can remain two adjacent files. Consistency means applying the same
decision rules, not producing identical directory silhouettes.

## One folder per implementation/test pair: decision

**Recommendation: reject it as a blanket rule; allow it by threshold.**

### Keep a flat adjacent pair when

```text
components/
├── student-shell.tsx
└── student-shell.test.tsx
```

- the implementation and test are the whole unit;
- neither has private assets, fixtures, types, or child components;
- the containing capability folder is still easy to scan; and
- imports remain unambiguous.

This is already maximum test colocation: the files are siblings. Adding a
directory does not make them more colocated.

### Give the unit its own folder when

```text
components/student-chat-message/
├── student-chat-message.tsx
├── student-chat-message.test.tsx
├── student-chat-message-content.tsx
└── student-chat-message.fixtures.ts
```

- it owns three or more related files;
- it has private children or fixtures that should not look capability-public;
- multiple test files cover distinct behaviors;
- it needs a local README/story/style/asset; or
- its name is a useful namespace in a crowded capability.

### Costs of forcing every pair into a folder

- More directory traversal for no new boundary.
- Longer or noisier imports unless an `index.ts` barrel is added.
- Pressure to create hundreds of tiny barrels. Large barrels can increase
  module loading/build work; Vercel's measured package examples demonstrate
  the risk, though those very large packages are not equivalent to a small
  Morshid feature. [Vercel package-import analysis](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js)
- More mechanical rename churn and merge conflicts during the refactor.
- A false sense of modularity: TypeScript still permits any deep import unless
  lint/package boundaries prohibit it.

Therefore, prefer direct imports inside a capability. If a cross-feature API is
needed, expose a small intentional module such as `features/auth/session.ts` or
`features/auth/routing.ts`; do not create a broad feature `index.ts` that
re-exports every page, component, hook, and API function.

## Dependency direction to enforce

The intended graph should be simple enough to explain:

```text
routes  ───────► features ───────► shared UI/infrastructure
                    │
                    └──► another feature's explicit public contract only

shared UI/infrastructure ─X─► features or routes
feature private module    ─X─► another feature's private module
```

Within a capability, a practical direction is:

```text
page/component ─► hook ─► query options ─► API ─► schema/shared HTTP
       │                         │
       └─────────────────────────┴──────► pure domain/schema modules
```

This is a dependency heuristic, not a demand for one file per box. Same-layer
imports are acceptable when they express a cohesive unit. Cycles are not.

Suggested enforcement work for the implementation plan:

1. Restore cycle detection or replace the currently disabled rule with a tool
   that correctly understands the repository's aliases.
2. Add restricted-import patterns so `components/`, `lib/`, and `providers/`
   cannot import feature-private code.
3. Define each cross-feature contract before banning deep imports. The current
   notification-to-student graph is the best pilot because it exposes a real
   dependency question.
4. Run lint, typecheck, Vitest, build, and acceptance tests after each capability
   move. Route generation should run as part of the Start/Vite workflow; never
   repair `routeTree.gen.ts` by hand.

## Testing placement standard

| Test kind | Recommended location | Naming |
| --- | --- | --- |
| Pure unit/schema/API contract test | Beside the implementation | `name.test.ts` |
| React component/hook test | Beside the component or hook | `name.test.tsx` |
| Capability integration test | Beside the page/flow, or capability-local `testing/`/`tests/` when it spans several source files | `behavior.integration.test.tsx` |
| Route contract test | Under `routes/` only when it directly tests the generated route/config behavior; use the `-` ignore prefix | `-role-routes.test.tsx` |
| Full browser acceptance journey | Root `tests/acceptance/`, grouped by user journey | `journey.spec.ts` |
| Fixture used by one test | Beside or inside that test file | Descriptive local name |
| Fixture used across one capability | `<capability>/testing/` | Domain-oriented fixture/builder name |
| Fixture used across acceptance journeys | `tests/acceptance/support/` | Journey/infrastructure-oriented name |

Do not create a test solely because a file exists. Testing Library and
Playwright both prioritize behavior; several private components may be covered
more durably through one user-visible capability test.

## Migration order with the least architectural risk

1. **Write the naming and dependency ADR first.** Agree on what “feature”,
   “capability”, “shared”, “API”, “query”, “hook”, and “service” mean.
2. **Standardize imports.** Choose `@/*`, migrate `#/*`, and prove Vite,
   TypeScript, Vitest, and SSR builds agree.
3. **Add boundary checks before mass moves.** Initially report current
   violations; then define contracts and turn each rule into an error.
4. **Pilot one bounded capability.** Notifications plus its student dependency
   is a stronger pilot than a purely cosmetic component move because it tests
   cross-feature ownership.
5. **Split the largest features by capability.** Move source and tests together;
   do not create all role folders in advance.
6. **Normalize routes only where navigation improves.** Preserve thin adapters
   and generated-tree behavior. A mixed route tree is acceptable.
7. **Refactor acceptance support after the source tree settles.** Browser tests
   should require little or no change when internal modules move; if they do,
   they are probably coupled to implementation details.
8. **Extract another npm workspace only after evidence.** Candidates must have a
   stable public API, independent consumers or release/build needs, and a clear
   dependency direction. Directory neatness is insufficient.

## Questions worth grilling before approving a refactor

1. What concrete failure are we fixing: slow discovery, ambiguous ownership,
   cycles, oversized files, unsafe server/client imports, or visual dislike of
   the tree?
2. Is `student` one feature, a user role containing several domain
   capabilities, or both? Which concept should own chat sessions and reviews?
3. Should notifications own navigation resolution, or consume a small student
   navigation contract? Why may it currently read student API and UI internals?
4. What is the allowed cross-feature dependency graph? Which dependencies are
   one-way, and which shared concepts deserve promotion?
5. What would qualify a frontend “service”? Is the proposed folder naming the
   behavior, or merely copying the NestJS backend vocabulary?
6. What measurable threshold earns a component/hook its own directory?
7. Are broad `index.ts` files forbidden, allowed only as public contracts, or
   unrestricted? How will route chunks be checked after introducing them?
8. Do route files own loaders and search validation, or may those be exported by
   features? Where is the boundary between route policy and reusable feature
   behavior?
9. Which tests should remain stable across a file move? If a test must change,
   is that because of an import path or because it tested an implementation
   detail?
10. What is the rollback unit? A capability-by-capability migration is
    reviewable; a whole-client move is difficult to review and bisect.

## Source index

Primary/official sources:

- [TanStack Start: Routing](https://tanstack.com/start/latest/docs/framework/react/guide/routing)
- [TanStack Start: Path Aliases](https://tanstack.com/start/latest/docs/framework/react/guide/path-aliases)
- [TanStack Start: Import Protection](https://tanstack.com/start/latest/docs/framework/react/guide/import-protection)
- [TanStack Router: File-Based Routing](https://tanstack.com/router/latest/docs/routing/file-based-routing)
- [TanStack Router: File Naming Conventions](https://tanstack.com/router/latest/docs/routing/file-naming-conventions)
- [TanStack Router: Code Splitting](https://tanstack.com/router/latest/docs/guide/code-splitting)
- [TanStack Query: Query Options](https://tanstack.com/query/latest/docs/react/guides/query-options)
- [React: Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [React: Components and Hooks Must Be Pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure)
- [Vitest: Writing Tests](https://vitest.dev/guide/learn/writing-tests.html)
- [Testing Library: Introduction](https://testing-library.com/docs/)
- [Testing Library: About Queries](https://testing-library.com/docs/queries/about/)
- [Playwright: Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright: Configuration](https://playwright.dev/docs/test-configuration)
- [Playwright: Page Object Models](https://playwright.dev/docs/pom)
- [Playwright: Fixtures](https://playwright.dev/docs/test-fixtures)
- [TypeScript: `paths`](https://www.typescriptlang.org/tsconfig/paths.html)
- [TypeScript: Project References](https://www.typescriptlang.org/docs/handbook/project-references)
- [npm 11: Workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/)
- [ESLint: `no-restricted-imports`](https://eslint.org/docs/latest/rules/no-restricted-imports)

Directly relevant practitioner sources:

- [Kent C. Dodds: Colocation](https://kentcdodds.com/blog/colocation)
- [Vercel Engineering: How we optimized package imports in Next.js](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js)

