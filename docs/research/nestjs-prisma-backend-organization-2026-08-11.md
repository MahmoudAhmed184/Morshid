# NestJS and Prisma backend organization research

**Research date:** 11 August 2026  
**Scope:** Morshid's NestJS 11.1 / Prisma 7.8 / TypeScript 6 backend in the
existing npm workspace  
**Status:** Planning evidence only; no source files were moved

## Executive recommendation

Organize the backend **by business capability first**, using each Nest feature
module as the main encapsulation boundary. Keep a small module flat. When a
module becomes difficult to scan, split it into cohesive capability folders,
not repository-wide technical buckets such as `services/`, `controllers/`, and
`repositories/`.

Do **not** make `services/<service-name>/<service-name>.service.ts` plus its test
the mandatory shape for every service. That convention adds a directory and a
deeper import for almost every production file without creating an actual Nest,
TypeScript, or package boundary. A folder is justified when it names a
capability and contains a meaningful cluster of cooperating files. Tests for a
unit should normally remain adjacent to that unit inside the same capability
folder.

The proposed rule for Morshid is therefore:

> Feature module -> capability folder when needed -> implementation and its
> adjacent focused tests.

This is a hybrid, not an absolutist layout. A nine-file module does not need the
same ceremony as the current 91-file `socratic-tutor` module.

## What the sources establish

### Nest modules, not folders, are the runtime boundary

Nest says that an application normally has multiple modules, each
encapsulating a closely related set of capabilities. Providers are encapsulated
by default, and the providers named in a module's `exports` metadata form its
public API. Its feature-module example places a controller, service, and module
together in the feature directory. See the official [Nest modules
documentation](https://docs.nestjs.com/modules).

Consequences for this refactor:

- A directory move by itself does not improve encapsulation.
- `imports` and narrowly selected `exports` in `@Module()` are the first public
  API to design.
- A consumer should import the owning feature module and inject an exported
  provider/token. It should not register another module's provider again.
- Controllers should stay at the transport edge and delegate non-HTTP work to
  providers, consistent with the official [Nest providers
  guidance](https://docs.nestjs.com/providers).
- Prefer an acyclic module graph. Nest explicitly says circular dependencies
  should be avoided where possible and warns that provider/module barrel files
  can themselves cause cycles; see [Circular dependency](https://docs.nestjs.com/fundamentals/circular-dependency).

### Nest does not prescribe one folder per provider

Nest's canonical feature-module example is flat: `cats.controller.ts`,
`cats.service.ts`, and `cats.module.ts` are siblings. The generated starter also
places `app.controller.spec.ts` beside `app.controller.ts`; see [First
steps](https://docs.nestjs.com/first-steps). At the same time, the CLI exposes a
`generateOptions.flat` switch, so flat versus nested output is intentionally
configurable rather than an architectural law; see [Nest CLI workspace generate
options](https://docs.nestjs.com/cli/monorepo#global-generate-options).

Nest automatically scaffolds unit tests for components and E2E tests for
applications, but it does not require one test file for every class. See [Nest
testing fundamentals](https://docs.nestjs.com/fundamentals/testing) and the
[CRUD generator](https://docs.nestjs.com/recipes/crud-generator). Test behavior
and contracts; do not manufacture a one-to-one test-file census for DTOs,
interfaces, constants, or trivial composition files.

### Feature-first is the stronger organizing signal

The official Nest feature-module guidance says closely related code serving the
same application domain belongs together. A useful supporting practitioner
view is Philipp Hauer's [Package by Feature](https://phauer.com/2020/package-by-feature/):
technical-role buckets make a feature harder to see, while self-contained
feature packages improve discoverability; within a small feature, extra
subpackages can add more ceremony than value. This source is advisory rather
than normative, but it agrees with Nest's own feature-module model.

For Morshid, `services/`, `controllers/`, and `repositories/` may be useful as a
local secondary grouping only when a module has no clearer business
sub-capabilities. They should not become the top-level architecture or force a
folder around a two-file implementation/test pair.

### Barrels and public APIs need two different policies

Within the Nest application, the owning `@Module()` metadata is the runtime
public API. Use direct file imports inside a capability; do not use local
`index.ts` barrels to import Nest modules/providers, because Nest explicitly
warns that this can create circular file imports.

At a **real package** boundary, an intentional entry point is valuable. Nest
libraries generate an `index.ts` entry point; see [Nest CLI
libraries](https://docs.nestjs.com/cli/libraries). Node recommends the
`package.json` `exports` field for new packages because it explicitly defines
and encapsulates supported entry points; see [Node package entry
points](https://nodejs.org/api/packages.html#package-entry-points). These facts
do not justify turning every server feature into a package.

If a module must expose compile-time contracts to another module, prefer an
explicitly named file such as `course-access.contract.ts` or
`review-case.port.ts`, placed at an obvious module boundary. Avoid a broad
`index.ts` that silently republishes every internal provider.

### npm workspaces and TypeScript project references are package-scale tools

The root is already an npm workspace with two packages, `client` and `server`.
npm workspaces are local packages linked into `node_modules` and addressed by
their package names; see [npm 11 workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/).
The server itself is a standard-mode Nest project (`nest-cli.json` has no Nest
`monorepo` or `projects` graph). Nest says its standard/monorepo choice affects
project composition and build output, while framework features otherwise work
the same; see [Nest CLI workspaces](https://docs.nestjs.com/cli/monorepo).

Do not convert this backend into a Nest monorepo merely to rearrange folders.
Promote code to a workspace/library only after there is a real independent
consumer, ownership/deployment boundary, or substantial build reason.
TypeScript project references can enforce logical separation and improve large
builds, but they add composite builds and declaration-output constraints; see
[TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references).
The current refactor does not yet justify a `tsconfig` project per feature.

### Prisma source, generated code, and migrations have different ownership

Prisma 7's `prisma-client` generator requires an output path and generates
plain TypeScript as a multi-file client. Morshid's
`server/src/generated/prisma` matches Prisma's documented example; see [Prisma
generators](https://www.prisma.io/docs/orm/prisma-schema/overview/generators).
It is generated output, already ignored by Git, ESLint, and Prettier in this
repository, and regenerated before build/lint/typecheck/test. Keep it out of
feature folders and never hand-edit it.

Migrations are the opposite: Prisma calls `prisma/migrations` the source of
truth for data-model history and requires committing the **entire** directory,
including `migration_lock.toml`; see [Prisma migration
histories](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories).
Keep migrations central and chronological. Do not distribute old or new
migration directories among Nest modules.

Morshid's `schema.prisma` is now 969 lines, so a multi-file schema is a
reasonable independent cleanup. Prisma officially recommends grouping related
models by domain, not one model per file. For a multi-file schema, the configured
schema path must point to the directory; the main `schema.prisma` and
`migrations/` must stay at the same level. See [Prisma schema location and
multi-file organization](https://www.prisma.io/docs/orm/prisma-schema/overview/location).

## Fit against the current repository

### What already fits

- The root npm workspace separates the runnable client and server packages.
- `server/src/modules/` is already feature-first at its top level.
- Unit/component specs are generally colocated in `src`; whole-application E2E
  specs live in `server/test`, which is a sound distinction.
- `server/src/generated/prisma` is treated as generated output.
- `server/prisma/migrations` is centralized, committed, and documented as
  forward-only.
- Names generally follow Nest's recognizable kebab-case suffixes:
  `.module.ts`, `.controller.ts`, `.service.ts`, `.repository.ts`, `.guard.ts`,
  `.adapter.ts`, `.policy.ts`, and `.spec.ts`.

### Where the current shape stops scaling

There are 342 TypeScript files under `server/src/modules` across 20 top-level
module directories. The distribution is very uneven:

| Module | TypeScript files directly in the module root |
| --- | ---: |
| `socratic-tutor` | 91 |
| `reviews` | 35 |
| `materials` | 25 |
| `student-chat` | 24 |
| `completion` | 14 |
| `courses` | 9 |
| `health` | 3 |

The small modules are readable while flat. The 91-file and 35-file roots no
longer reveal their internal capabilities. Applying identical directory depth
to all of them would optimize for visual symmetry rather than navigation.

Cross-module implementation imports are also common. Examples include modules
reaching directly into `auth.dto`, `auth.guard`, `audit.service`, review
internals, completion internals, and generated Prisma types. Not all are wrong,
but a folder move will make these paths longer without deciding which are
supported contracts. The architecture plan should inventory and classify those
imports before moving files.

## Recommended target rules

### 1. Feature modules remain the first-level boundary

Keep business capabilities under `server/src/modules/<feature>/`. Keep
`<feature>.module.ts` at the module root as the visible composition root.

Small module default:

```text
courses/
├── courses.module.ts
├── courses.controller.ts
├── courses.service.ts
├── courses.service.spec.ts
├── courses.repository.ts
├── courses.dto.ts
├── courses.errors.ts
├── course-access.policy.ts
├── course-access.service.ts
└── course-access.service.spec.ts
```

This is not disorder; at this size it keeps the whole feature visible in one
screen and resembles Nest's canonical feature-module layout.

### 2. Large modules split by cohesive capability

Split a module when its root is hard to scan, a group changes for the same
reasons, or the group can be named in domain language. An indicative—not yet
final—shape for the current large tutor module is:

```text
socratic-tutor/
├── socratic-tutor.module.ts
├── turn-lifecycle/
│   ├── turn.service.ts
│   ├── turn.service.spec.ts
│   ├── turn.repository.ts
│   ├── turn.types.ts
│   └── topic-state.repository.ts
├── educational-analysis/
│   ├── educational-analysis.service.ts
│   ├── educational-analysis.service.spec.ts
│   ├── educational-analysis.repository.ts
│   ├── educational-analysis.schema.ts
│   ├── educational-analysis.schema.spec.ts
│   └── educational-analysis.types.ts
├── teaching-decision/
│   └── ...policy, selector, persistence, and adjacent specs...
├── response-generation/
│   └── ...prompt, model port/adapter, generator, and adjacent specs...
└── response-approval/
    └── ...structural/deterministic/semantic guards and adjacent specs...
```

The names and exact ownership must be confirmed from the dependency graph and
domain language before moves. The important property is that each directory
represents a capability, not that every directory has identical technical
subfolders.

### 3. Colocate focused tests; separate system tests

- Keep `foo.ts` and `foo.spec.ts` adjacent in the same capability folder.
- Keep Nest module-wiring specs adjacent to `<feature>.module.ts`.
- Keep full API/database journey tests under `server/test` as
  `*.e2e-spec.ts`, organized by user journey or API capability when that folder
  itself becomes difficult to scan.
- Keep reusable E2E fixtures/harnesses under `server/test/fixtures` and
  `server/test/support`.
- Do not require a spec for declarations that have no behavior. Require focused
  regression coverage for behavior changes and boundary tests for module
  wiring/public contracts.

The existing Jest `rootDir: "src"` and `.*\\.spec\\.ts$` pattern already finds
nested colocated specs, and `tsconfig.build.json` already excludes nested
`**/*spec.ts`; no test-layout reconfiguration is required for source moves.

### 4. Keep the vocabulary precise

- Use kebab-case filenames and stable role suffixes where they add information.
- Prefer domain/use-case names such as `ReviewCaseCreator`,
  `TeachingPolicySelector`, `StudentChatMessagePresenter`, and
  `SocraticChatOrchestrator` over multiplying generic `SomethingService`
  classes.
- Treat a repository abstraction and Prisma implementation as one cohesive file
  while small. Split them into an explicit `*.port.ts` and
  `prisma-*.repository.ts` only when implementations, testing seams, or API
  clarity justify it.
- Avoid vague catch-alls such as `utils`, `helpers`, or an ever-growing
  `common`. Shared code should be technical, stable, and used by multiple
  features; domain concepts belong to an owning feature.

### 5. Make dependency rules explicit before moving files

The target dependency policy should be:

1. Imports within one capability may use direct relative file paths.
2. Imports across capabilities in one feature may use explicit files owned by
   that feature; avoid recursive `index.ts` barrels.
3. Imports across Nest features should target the owning module and its explicit
   contract/token, never a Prisma repository implementation or other internal
   provider.
4. A module exports the smallest provider/token set consumers need.
5. No feature may depend on a feature that already depends on it; `forwardRef()`
   is an exception requiring an architectural explanation, not a normal fix.
6. Add a static import-boundary check after the allowed graph is agreed. Folder
   naming without enforcement is only documentation.

Generated Prisma enums/types are infrastructure-wide generated contracts, so
direct imports from the configured generated entry points are a deliberate
exception. Application-level domain contracts should not otherwise be defined
by incidental Prisma repository shapes.

### 6. Split Prisma by domain in a separate change

An eventual schema-only shape could be:

```text
server/prisma/
├── schema.prisma
├── models/
│   ├── identity.prisma
│   ├── courses-and-materials.prisma
│   ├── chat-and-tutoring.prisma
│   ├── reviews-and-notifications.prisma
│   └── audit.prisma
├── migrations/
└── seed.ts
```

That change requires updating `prisma.config.ts` from the single file path to
the `prisma` directory, then proving the split is schema-neutral. Do not combine
it with hundreds of TypeScript moves in the same review unit.

## Decision matrix for the proposed folder-per-service rule

| Proposal | Decision | Reason |
| --- | --- | --- |
| One module folder per business feature | Adopt | Matches Nest's encapsulation model |
| `services/`, `controllers/`, `repositories/` in every module | Do not mandate | Technical grouping can scatter one capability and adds ceremony to small modules |
| One directory per service containing only source + spec | Reject as default | Two files do not form a useful architectural boundary |
| One capability directory containing service, port/repository, DTO/schema, and specs | Adopt for substantial capabilities | Maximizes cohesion and makes change scope visible |
| Unit spec adjacent to implementation | Adopt | Fast navigation and consistent with Nest's generated layout |
| One spec file for every production file | Reject | Coverage should follow behavior and contracts, not file count |
| Broad `index.ts` barrels for Nest providers | Reject | Nest documents circular-import risk |
| Explicit package entry points for actual reusable packages | Adopt when a package exists | Node `exports` can enforce a package API |
| Move generated Prisma client into features | Reject | It is generated infrastructure code |
| Move migrations into feature modules | Reject | Prisma requires one committed migration history |
| Split the large Prisma schema by domain | Investigate as a separate refactor | Officially supported and proportionate at 969 lines |

## Low-risk refactor sequence to plan

1. **Freeze invariants.** Record that this is a structure-only effort: no API,
   DI token, SQL, schema, runtime behavior, or test-semantic changes.
2. **Map the dependency graph.** Classify every cross-module import as public
   contract, shared technical infrastructure, generated Prisma contract, or
   boundary violation. Agree on ownership before paths change.
3. **Write the layout convention.** Put the final rules in `AGENTS.md` or a
   short architecture decision after the grill session resolves the open
   choices. Include examples for small and large modules.
4. **Pilot one medium module.** `courses` is small enough to expose tooling and
   import-path issues without hiding them in a 91-file diff. If no capability
   split adds value, leaving it flat is a successful pilot result.
5. **Refactor one large module by capability.** `reviews` is a better first
   structural proof than `socratic-tutor`: it already contains visible manual
   request, instructor queue/detail/action, and student detail clusters.
6. **Move `socratic-tutor` in bounded slices.** Move one capability and its
   tests per commit; update the module composition root and consumers in the
   same commit.
7. **Apply the proven rule selectively.** Leave readable small modules flat;
   restructure `materials`, `student-chat`, `completion`, and `embedding` only
   where capability boundaries are clear.
8. **Enforce imports.** Add a dependency rule/check only after the allowed
   public graph is documented and existing exceptions are resolved.
9. **Split Prisma independently.** Validate, regenerate, and show a zero-change
   schema diff before accepting the multi-file schema move. Never rewrite old
   migrations.
10. **Run the canonical gate.** Run focused Jest suites during each move, then
    `npm run check`; run server E2E and acceptance tests for changes that touch
    module wiring or application boot.

Keep rename-only commits separate from behavioral work. That makes review,
`git log --follow`, bisection, and rollback materially safer.

## Questions the grill session should settle next

1. Is the desired outcome faster human navigation, enforceable module
   isolation, easier AI navigation, reduced merge conflict, or visual
   uniformity? These lead to different structures.
2. Which current cross-module imports are intentional public contracts?
3. What domain capabilities does the team recognize inside `reviews`,
   `student-chat`, and `socratic-tutor`?
4. What observable threshold triggers a capability folder: file count,
   multiple independent change reasons, ownership, or navigation pain?
5. Should the import graph be enforced in CI, and which current exceptions are
   temporary?
6. Is the Prisma multi-file split in scope for the same initiative but a
   separate change set, or explicitly deferred?

## Source hierarchy and limitations

The recommendations above prioritize current official NestJS, Prisma,
TypeScript, Node.js, and npm documentation. The package-by-feature article is
included only as a clearly identified practitioner perspective. None of these
sources proves that a single directory tree is universally optimal; the final
choice is an architectural trade-off grounded in Morshid's dependency graph and
team workflow. File counts and configuration observations are from the local
repository on 11 August 2026.
