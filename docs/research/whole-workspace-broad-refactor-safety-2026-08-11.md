# Whole-workspace broad refactor safety research (2026-08-11)

**Research date:** 11 August 2026
**Scope:** Safe execution of a broad architecture and file-organization refactor
across Morshid's client, server, database, tests, scripts, and documentation
**Status:** Planning evidence only; no application code was changed

## Executive recommendation

Treat “broad refactor” as permission to improve architecture and behavior across
the whole workspace, **not** as permission to combine all changes into one
rewrite. Run one program made of independently mergeable vertical slices:

1. Freeze and automate today's observable contracts before moving code.
2. Record the target dependency rules and compatibility policy as architecture
   decisions.
3. Move and reshape one capability at a time, keeping the old seam available
   when consumers cannot move atomically.
4. Separate behavior-preserving structural commits from deliberate behavior or
   contract changes, even when both belong to the same initiative.
5. Use a new API version for intentional breaking HTTP changes, and use
   expand-and-contract across multiple deployments for destructive database
   changes.
6. Make every intermediate commit buildable and every merge candidate pass the
   repository's complete gate. Enforce the new dependency graph in CI so the
   architecture cannot silently regress.

The implication is that the final architecture can be ambitious, but the
migration must be incremental. A branch-wide “move everything, redesign
everything, then make tests pass” approach discards the strongest safety
property of refactoring: locating a regression in a small, behavior-preserving
step.

## Current Morshid baseline

- The repository is one private npm workspace with `client` and `server`
  packages, and already exposes a canonical gate that runs formatting, strict
  linting, type checks, tests, and both builds. See
  [`package.json`](../../package.json#L1-L12) and
  [`package.json`](../../package.json#L32-L56).
- GitHub CI runs that canonical gate, then deploys Prisma migrations and runs
  server E2E tests; a separate job deploys migrations, seeds deterministic data,
  and runs Playwright acceptance tests. See
  [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml#L20-L65) and
  [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml#L67-L120).
- The HTTP surface is already presented under `/api/v1`. Morshid generates an
  OpenAPI 3.0.4 document in development and test environments, but there is no
  checked-in API baseline in the observed repository. See
  [`server/src/app.setup.ts`](../../server/src/app.setup.ts#L4-L20) and
  [`server/src/app.setup.ts`](../../server/src/app.setup.ts#L57-L64).
- The Prisma migration history is committed and the repository explicitly
  treats migrations as forward-only after they leave disposable development.
  See [`server/prisma/README.md`](../../server/prisma/README.md#L16-L21).
- The PR template already demands `npm run check`, but its conditional
  validation text mentions server E2E and not the root Playwright acceptance
  command. See
  [`.github/pull_request_template.md`](../../.github/pull_request_template.md#L5-L12).

These are useful foundations. The refactor should strengthen them rather than
inventing a parallel validation workflow.

## Evidence and consequences

### 1. “Broad” still needs two hats

Martin Fowler defines refactoring as changing internal structure without
changing observable behavior. Its safety comes from a series of small,
behavior-preserving transformations that leave the system working after every
step. See [Refactoring](https://refactoring.com/). His “two hats” guidance says
that a refactoring step preserves behavior and keeps tests green, while adding
or changing function is a different mode with different test consequences. See
[An example of preparatory refactoring](https://martinfowler.com/articles/preparatory-refactoring-example.html).

Consequences for Morshid:

- The initiative may contain mechanical moves, boundary redesign, renamed
  concepts, API evolution, UI changes, and schema changes. A single commit or
  PR should not hide all of those categories together.
- A structural commit should be reviewable with the question “did observable
  behavior stay the same?” A behavior commit should state its new acceptance
  criteria and tests. A schema commit should state its deployment ordering and
  data guarantees.
- Prefer this sequence when a capability needs redesign: characterize the old
  behavior, introduce or expose a seam, move/reorganize behind that seam, then
  change behavior in a subsequent step.
- Pure file moves should not opportunistically rename domain concepts or alter
  DTO shapes. Domain renames and contract changes deserve explicit review even
  when the old name is poor.

This is not a demand for one commit per file. It is a demand that each commit
has a coherent verification story and does not mix structural and semantic
uncertainty unnecessarily.

### 2. Define the compatibility promise before redesigning `/api/v1`

The OpenAPI Specification defines a language-independent description of an
HTTP API's operations, inputs, outputs, and schemas. Nest can generate that
serializable document and explicitly supports saving it as JSON or YAML. See
the [OpenAPI Specification 3.2.0](https://spec.openapis.org/oas/latest.html)
and [Nest OpenAPI introduction](https://docs.nestjs.com/openapi/introduction).

Google's current API design guidance says compatibility requirements may be
adapted for an API whose producer and consumer are controlled together, but
within an API version the expected representation of an existing field must
not change. See [AIP-180: Backwards compatibility](https://google.aip.dev/180).
GitHub's own REST policy provides a concrete taxonomy: removing operations,
renaming/removing request or response fields, adding required parameters,
changing types, tightening validation, and changing authentication or
authorization are breaking changes and are released in a new API version. See
[GitHub REST breaking changes](https://docs.github.com/en/enterprise-cloud@latest/rest/about-the-rest-api/breaking-changes).
Nest supports controller- or route-level coexistence of versions when an
application must continue serving an earlier contract. See
[Nest versioning](https://docs.nestjs.com/techniques/versioning).

Semantic Versioning reinforces the prerequisite: compatibility is only
meaningful after the public API is clearly declared, and incompatible public
API changes require a major version change. See
[Semantic Versioning 2.0.0](https://semver.org/). Morshid's private npm package
versions are not themselves an HTTP-versioning mechanism; the useful lesson is
to name the supported surface before classifying changes.

Consequences for Morshid:

- Generate and commit a normalized OpenAPI baseline for `/api/v1`, and verify it
  in CI. Morshid already has the document-generation machinery, so this is a
  small extension of the existing setup rather than a new source of truth.
- OpenAPI alone is incomplete: protect status codes, cookie behavior,
  authorization/RBAC outcomes, pagination, ordering, error envelopes, retry
  semantics, and relevant side effects with E2E/acceptance contract tests.
- Treat the current client as a real consumer even if it is deployed with the
  server. Coordinated ownership can shorten a deprecation window; it does not
  make an untested breaking change safe.
- Preserve `/api/v1` during structural work. If the target domain model needs a
  deliberately incompatible HTTP shape, add `/api/v2`, migrate the client, set
  a documented retirement criterion for V1, then remove V1 separately.
- Do not create V2 merely because TypeScript classes, Nest providers, or folders
  were renamed. Internal architecture is not the network contract.

An OpenAPI diff can provide a useful automated signal. The OpenAPI Tools
project's `openapi-diff` can fail on incompatible changes, but it should
supplement behavior tests rather than define all semantic compatibility. See
[OpenAPI Diff](https://github.com/OpenAPITools/openapi-diff).

### 3. Database redesign must use expand-and-contract

Prisma's current official guide describes expand-and-contract for production
schema changes: add the replacement representation, migrate data, then remove
the old representation in a later contraction. Its purpose is to preserve data
consistency and avoid downtime. See
[Prisma expand-and-contract migrations](https://www.prisma.io/docs/guides/database/data-migration).
Prisma also states that applied migration files should not be edited or
deleted, that the migration directory is the data-model history's source of
truth, and that the complete directory must be committed. See
[Prisma migration histories](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories).
For testing and production, Prisma recommends `migrate deploy` in CI/CD; it
does not reset a database or detect schema drift. See
[Prisma development and production workflows](https://docs.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production).

Consequences for Morshid:

- Folder organization alone should not trigger schema churn. Change the schema
  only when the agreed domain model or behavior requires it.
- A destructive rename/change is a deployment sequence, not one migration:

  1. **Expand:** add a compatible nullable/defaulted column, table, relation, or
     enum representation without removing the old one.
  2. **Bridge:** deploy code capable of reading old and new states; dual-write
     only where the consistency and retry semantics are explicitly designed.
  3. **Backfill:** migrate existing data with an idempotent, observable job or
     reviewed data-migration step; verify counts and invariants.
  4. **Switch:** make the new representation authoritative and stop old writes.
  5. **Contract:** only after every supported application version no longer
     depends on the old representation, drop it in a later migration.

- Test every migration chain from an empty database and from a representative
  pre-change database. A seeded fresh database proves replayability; it does not
  by itself prove that populated production data upgrades safely.
- Review generated SQL for locks and destructive operations before deployment.
  Prisma's deployment guide specifically recommends analyzing migration SQL for
  dangerous locking patterns. See
  [Deploying database changes with Prisma Migrate](https://docs.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate).
- Continue Morshid's forward-fix convention. A code rollback may need to remain
  compatible with the expanded schema; it does not imply editing or deleting an
  applied database migration.

### 4. Migrate architecture incrementally through seams

Fowler's Branch by Abstraction introduces an abstraction around the current
implementation, migrates callers to the abstraction, permits old and new
implementations to coexist, switches use gradually, and removes the old
implementation last. Its defining constraint is that the system continues to
build and run throughout the migration. See
[Branch By Abstraction](https://martinfowler.com/bliki/BranchByAbstraction.html).

Consequences for Morshid:

- Use ordinary direct moves for files whose consumers can update atomically.
  Do not manufacture interfaces for every file.
- Use branch by abstraction for a high-fan-in provider, cross-module service,
  external adapter, persistence boundary, or client data API that cannot be
  replaced safely in one small slice.
- The temporary seam may be a Nest injection token, a narrow application
  interface, a facade, a query/command adapter, or a client API module. It must
  express a real boundary and have an explicit removal condition; otherwise it
  becomes permanent accidental indirection.
- A runtime feature flag is warranted only when old/new behavior must coexist
  or be compared after deployment. A source-file relocation does not need a
  flag. If flags are used, keep the decision point separate from the routing
  mechanism and plan their removal, consistent with Fowler's
  [Feature Toggles](https://martinfowler.com/articles/feature-toggles.html).
- Prefer a sequence of short PRs into `dev` over one long-lived reorganization
  branch. Each merged slice reduces divergence and leaves the main development
  line releasable.

### 5. “Green” means the latest integrated commit passes the whole contract

GitHub status checks are intended to show whether a commit satisfies build,
test, and other repository conditions. When required, they must pass before a
pull request can merge, and required checks apply to the latest commit SHA. See
[GitHub status checks](https://docs.github.com/en/enterprise-cloud@latest/pull-requests/reference/status-checks)
and [troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).
Protected branches can require PR review, status checks, resolved conversations,
linear history, a merge queue, and prevention of bypass. See
[GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

Consequences for Morshid:

- Make the existing CI `validate` and `acceptance` jobs required on `dev`. Do
  not let a large refactor bypass them because the branch is “temporarily
  broken.”
- Run the smallest relevant checks during a slice, then `npm run check`, server
  E2E, and Playwright acceptance before merge. The repository's current CI
  already provides the full path.
- Add characterization tests before changing a weakly covered boundary; do not
  freeze every private implementation detail. Tests should protect behavior,
  public module/API contracts, security boundaries, and data invariants.
- Generated outputs (`routeTree.gen.ts` and generated Prisma code) should be
  regenerated and verified by their owning tools, never hand-moved to fit the
  new layout.
- Require clean install (`npm ci`) in CI, because local caches and stale build
  artifacts can hide bad imports after mass moves.

### 6. Folder rules must become executable dependency rules

ESLint's official `no-restricted-imports` rule supports exact paths and glob or
regular-expression patterns, with custom guidance messages. It checks static
imports and re-exports, but its documented limitation is that it does not cover
dynamic imports. See
[ESLint `no-restricted-imports`](https://eslint.org/docs/latest/rules/no-restricted-imports).
TypeScript project references can enforce stronger logical separation and
improve build performance, but require composite projects, declarations, and a
different build workflow. See
[TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references).

For path-aware graph constraints without turning every feature into a TS
project, dependency-cruiser is a credible purpose-built option. Its maintained
documentation supports forbidden/allowed dependency rules, circular and
unresolvable dependency checks, and error severity that fails a build. It also
supports keeping known violations visible while rejecting new ones. See
[dependency-cruiser](https://github.com/sverweij/dependency-cruiser) and its
[rules reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md).

Consequences for Morshid:

- Start with ESLint restrictions for simple, stable rules: production cannot
  import tests; client features cannot import server code; domain code cannot
  import transport/UI infrastructure; and cross-feature consumers cannot deep
  import another feature's private implementation.
- Use a dependency graph tool if relative-path imports, aliases, cycles, or
  whole-folder constraints make ESLint patterns too fragile. Adding TypeScript
  project references solely to enforce the first version of the architecture
  is probably disproportionate for the current two-workspace layout.
- Ratchet existing violations: capture a reviewed baseline, make new violations
  fail CI, and burn down the baseline capability by capability. Turning every
  current violation into an exception with no owner or removal criterion merely
  codifies the old architecture.
- Tests must be allowed to import the unit's private surface where needed, but
  production code must never import test fixtures or mocks. Keep cross-workspace
  acceptance support at the repository boundary.

### 7. Record significant decisions, not every directory creation

AWS Prescriptive Guidance defines an ADR as a record of an architecturally
significant choice, its context, and consequences. Accepted ADRs form a
decision log, should be used during architecture/code review, and should remain
immutable; a later decision supersedes rather than silently rewrites the old
one. See
[AWS architectural decision record process](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html).

Consequences for Morshid:

- Reuse the repository's existing decision vocabulary: context, options,
  decision, and consequences already appear in the decision issue template.
- Create a small ADR set for decisions with lasting tradeoffs, for example:
  target dependency direction and public surfaces; feature/capability versus
  role-folder rules; test placement; API compatibility/versioning; database
  migration policy; and architecture enforcement tooling.
- Keep the migration inventory and file-move checklist in an implementation
  plan, not in the ADR. An ADR says **why a durable constraint exists**; it is
  not a task tracker or a snapshot of every path.
- Give each ADR a status (`proposed`, `accepted`, `superseded`, or `rejected`),
  decision owner, and links to enforcing tests/configuration.

## Recommended program shape

### Phase 0: freeze the safety baseline

- Ensure the working tree starts green under `npm run check`, server E2E, and
  Playwright acceptance.
- Capture a normalized `/api/v1` OpenAPI artifact and critical behavioral
  contracts.
- Inventory module/feature imports, cycles, public exports, environment
  boundaries, persistence ownership, and known cross-feature deep imports.
- Record current database invariants and validate migration replay.

### Phase 1: accept the target decisions

- Decide ownership/capability names and the permitted dependency graph.
- Decide when a unit earns its own folder; do not use directory depth as a
  proxy for encapsulation.
- Decide public entry points, test placement, API compatibility, schema-change
  policy, and enforcement tooling in ADRs.
- Add boundary checks in baseline/ratchet mode before mass moves begin.

### Phase 2: migrate one capability at a time

For each server module or frontend feature:

1. Add missing contract or characterization coverage.
2. Introduce a seam only if consumers cannot move atomically.
3. Move files and tests with no intended behavior change.
4. Narrow the public surface and update consumers.
5. Make the dependency rule strict for the migrated capability.
6. Perform deliberate domain/API/UI/schema changes as separately described
   follow-up work.
7. Delete temporary adapters and update documentation.

Start with one medium, representative capability rather than the smallest
trivial module or the largest/highest-risk module. Use it to test the folder
rule, import policy, review size, and validation cost before applying the
standard workspace-wide.

### Phase 3: remove transitional architecture

- Remove legacy entry points, compatibility adapters, flags, dual writes, and
  rule-baseline exceptions only after their consumers are gone.
- Contract database representations only after the old application contract is
  no longer deployable.
- Supersede any ADR whose real-world consequences forced a different decision.
- Run the complete gate from a clean checkout and update the developer guide.

## Definition of done for each migration slice

A slice is complete only when:

- its intended behavior and compatibility classification are explicit;
- production code and tests have one clear owner in the target architecture;
- moved code has no compatibility barrel or forwarding file unless one is
  intentionally temporary and has a deletion criterion;
- new dependency violations and cycles are rejected automatically;
- API, RBAC, error, persistence, and UI contracts relevant to the slice pass;
- any schema step documents expand/bridge/backfill/switch/contract ordering;
- `npm run check` passes, and the affected E2E/acceptance suites pass;
- an ADR or durable architecture guide is updated when the slice establishes a
  lasting rule.

## Decisions the grill session must force next

1. **Compatibility:** Does “broad” permit breaking `/api/v1` immediately, or
   must V1 remain stable while a V2 is introduced and the client migrates?
   **Recommendation:** preserve V1; require explicit V2 plus a retirement
   criterion for intentional breaking changes.
2. **Database scope:** May the organization refactor redesign the Prisma domain
   model now, or should schema changes be admitted only by a separately stated
   domain/behavior decision? **Recommendation:** the latter; layout is not
   sufficient justification for persistent data churn.
3. **Integration strategy:** One long-lived whole-repository branch, or a
   sequence of green PRs into `dev` organized by capability? **Recommendation:**
   green capability slices; use branch by abstraction only at seams that truly
   need coexistence.
4. **Change separation:** May file moves, domain renames, and behavior changes
   share a PR? **Recommendation:** they may share one initiative, but structural
   and behavioral commits must remain independently reviewable; split PRs when
   either side is nontrivial.
5. **Enforcement:** Are folder rules advisory, ESLint-enforced, or graph-enforced
   with a baseline ratchet? **Recommendation:** automated graph enforcement for
   module/feature direction and cycles, plus ESLint for simple import bans.
6. **Merge policy:** Will both existing CI jobs be required on `dev`, with no
   refactor bypass? **Recommendation:** yes; a green local run is evidence, but
   the latest integrated commit must pass protected-branch checks.

## Source-quality note

Primary sources were preferred: Nest, Prisma, OpenAPI, TypeScript, ESLint,
GitHub, Google Cloud/API guidance, SemVer, and AWS Prescriptive Guidance.
Martin Fowler's first-person material is used for the practitioner techniques
of behavior-preserving refactoring, two hats, branch by abstraction, and feature
toggles, where framework documentation does not prescribe an execution method.
The dependency-cruiser project documentation is used only for the capabilities
of that optional tool; selecting it remains an architectural decision rather
than a sourced mandate.
