# Dead, unused, and unwired-code audit

- **Status:** Pending owner approval; no cleanup implementation has started
- **Audit date:** 2026-08-12 (Africa/Cairo)
- **Audited branch:** `refactor/whole-workspace-architecture`
- **Audited SHA:** `b3e4c5ba86e4e215f34646b5476974b66d5116ea`
- **Source SHA:** `22fc7fbdce59fb2248db39a1bfd7b4d0b86f0480`

This report records a read-only post-refactor audit. The only file created by
this audit is this report. No production source, test, fixture, schema,
generated file, script, configuration, or documentation file was deleted or
edited.

## Executive result

The final dependency graph is healthy. The audit found two high-confidence
client cleanup candidates and one medium-confidence server adapter that is
unwired from application startup but intentionally used by a standalone
operational probe. The latter is not safe to delete without deciding whether
that probe remains a supported operational path.

No obsolete tutoring execution path remains in current source, tests, scripts,
or client code. The diagnosis behavior is now wired through the one
`TutoringRuntime` and one Socratic workflow. Current P0 product documents still
describe the seeded Python course and Python-only demo coverage; that is a
product-scope documentation question, not evidence that the deleted legacy
runtime is still present. It is recorded separately below and has not been
changed.

## Audit method

The audit used four read-only scopes with independent repository inspection:

1. NestJS server modules, providers, exports, platform adapters, and legacy
   tutoring names.
2. Client routes, workspaces, features, components, hooks, and test-only
   imports.
3. Package scripts, Prisma/Compose/CI support, fixtures, tests, and current
   documentation references.
4. The diagnosis call graph, debugging contract, deterministic adapter,
   configured production model path, response governance, and course evidence
   boundary.

The local pass additionally used repository-wide `rg` searches, the
dependency-cruiser graph, exact import tracing, and the focused checks listed
in [Validation](#validation).

## Findings requiring approval

### DC-001 — unused instructor dashboard constants

- **Classification:** Confirmed dead code
- **Confidence:** High
- **Path:** [`client/src/workspaces/instructor/dashboard/instructor-dashboard.constants.ts`](../../client/src/workspaces/instructor/dashboard/instructor-dashboard.constants.ts#L1-L6)
- **Evidence:** The file exports only `reviewQueueFilters`. A repository-wide
  exact-symbol search found no consumer. The live dashboard composes
  `DashboardReviewQueuePanel` directly in
  [`instructor-dashboard-page.tsx`](../../client/src/workspaces/instructor/dashboard/instructor-dashboard-page.tsx#L37-L46),
  and the panel has no dependency on these values.
- **Proposed cleanup:** Delete the unused constants file after approval.
- **Risk:** Low. No runtime or test consumer was found.
- **Post-cleanup proof:** Search for `reviewQueueFilters` and run the client
  typecheck, lint, architecture, and build gates.

### DC-002 — test-only role placeholder page

- **Classification:** Unwired production component; its colocated test is
  consequently testing an unreachable implementation
- **Confidence:** High
- **Path:** [`client/src/features/auth/routing/role-placeholder-page.tsx`](../../client/src/features/auth/routing/role-placeholder-page.tsx#L1-L17)
- **Evidence:** The only import is the colocated
  [`role-placeholder-page.test.tsx`](../../client/src/features/auth/routing/role-placeholder-page.test.tsx#L13-L17).
  No route, workspace, app-composition, generated route, or dynamic import
  references `RolePlaceholderPage`. Current Admin, Instructor, and Student
  routes resolve to real pages.
- **Proposed cleanup:** Remove the unreachable component and its test, while
  preserving any sign-out behavior coverage in the owning auth-session seam if
  that behavior is not already covered there. Do not retain a placeholder or
  compatibility route.
- **Risk:** Low for production reachability; medium for test coverage if the
  test's sign-out assertions are removed without moving the underlying behavior
  assertion to the auth owner.
- **Post-cleanup proof:** Search for `RolePlaceholderPage` and
  `role-placeholder-page`, inspect the generated route tree through the normal
  route-generation check, and run the client test/check gates.

### UW-001 — ITI gateway transport is application-unwired

- **Classification:** Unwired production adapter, but not repository-wide dead
  code
- **Confidence:** Medium
- **Path:** [`server/src/platform/ai/upstream/iti-gateway-transport.ts`](../../server/src/platform/ai/upstream/iti-gateway-transport.ts#L1-L186)
- **Evidence:** No production import from `server/src` reaches its exports.
  The only consumer is the explicit operational probe
  [`server/scripts/iti-bedrock-embedding-contract-probe.mts`](../../server/scripts/iti-bedrock-embedding-contract-probe.mts#L1-L8).
  The transport owns shared SSRF, credential, and insecure-HTTP validation
  policy, so deleting it while retaining the probe would break that probe.
- **Proposed decision:** Keep it if the ITI embedding contract probe is a
  supported operational check; otherwise delete the probe and this transport
  together in one deliberate capability cleanup. Do not delete only the
  transport and leave a broken script.
- **Risk:** Medium. Removing it can remove the only maintained validation path
  for the ITI gateway; retaining it leaves a platform policy module that the
  application does not currently use.
- **Post-decision proof:** Run the exact ITI import search, server typecheck,
  server build, and the probe's documented configuration validation (without
  live credentials unless they are available).

## Diagnosis-path result

The quoted diagnosis problem is fixed in the implementation at the audited
SHA:

- [`TutoringRuntime`](../../server/src/modules/tutoring/interface/tutoring-runtime.ts#L1-L10)
  is the public tutoring seam, and
  [`TutoringRuntimeApplication`](../../server/src/modules/tutoring/tutoring-runtime.application.ts#L148-L171)
  is its single application implementation.
- The runtime sends ordinary requests and code-diagnosis requests to the same
  [`SocraticWorkflow`](../../server/src/modules/tutoring/socratic-workflow/socratic-workflow.ts#L38-L66)
  path. The diagnosis context is passed at
  [`tutoring-runtime.application.ts`](../../server/src/modules/tutoring/tutoring-runtime.application.ts#L352-L376).
- `CODE_DIAGNOSIS` and `DEBUGGING_ISSUE` are current domain values, and
  `DEBUGGING_GUIDANCE` selects `TRACE_EXECUTION` through the tutoring policy
  contract. The generic contract requires likely issue, relevant location,
  concept, and one inspection step.
- The deterministic TutorModel adapter now emits a contract-valid debugging
  guidance fixture for deterministic tests. It remains a test adapter; the
  configured production TutorModel is the real model path, as required by the
  approved plan.
- Course evidence comes through Materials' `CourseEvidence` boundary, and
  safety/source-conflict checks live in the private Tutoring response-governance
  path.
- The old `GroundedChatService`, `SocraticChatOrchestrator`,
  `CompletionProvider`/`CompletionModule`, public `OutputPolicy`, Python Tutor
  runtime, duplicate Retrieval path, and duplicate Attempt state are absent
  from current source, tests, scripts, and client code. No compatibility
  wrapper was retained.

### Documentation scope note

The architecture and implementation contract are generic, but the seeded P0
product documents remain intentionally Python-scoped in places such as:

- [`docs/morshid-decisions.md`](../morshid-decisions.md#L105-L115)
- [`docs/project-delivery-plan.md`](../project-delivery-plan.md#L219-L227)
- [`docs/fixture-update-conventions.md`](../fixture-update-conventions.md#L12-L21)
- [`docs/golden-dataset-p0-v1.md`](../golden-dataset-p0-v1.md#L1-L7)
- [`docs/demo-scenario-mapping.md`](../demo-scenario-mapping.md#L10-L30)

Those references describe the current one-course P0 evaluation scope, not a
legacy runtime entry point. The research note and the pre-refactor production
review explicitly label their old paths as historical evidence:
[`python-code-diagnosis-value.md`](../research/python-code-diagnosis-value.md#L1-L6)
and [`nourhan-pr-review.md`](../nourhan-pr-review.md#L1-L8). No documentation
was changed during this audit. If the requested cleanup means changing the
product contract itself from Python-only P0 coverage to general language
coverage, that is a separate behavior/documentation change and should not be
implemented as dead-code deletion.

## Excluded false positives

The following dependency-cruiser or orphan-looking files were traced and are
not dead code:

- `client/src/components/branding/get-user-initials.ts` is used by the
  authenticated sidebar and account settings.
- `client/src/features/chat/sessions/chat-scope.ts` is used by the Student
  session/message hooks.
- `client/src/features/reviews/interface/student-flag-reason.ts` is used by
  the Instructor review queue and detail pages.
- `client/src/lib/env.ts`, the instructor dashboard state, and Student greeting
  helper are consumed by live application composition.
- `server/src/modules/conversations/conversation-records.ts` is a shared
  domain record contract used by Conversations and Tutoring.
- Tutoring interface/type files are public seams or workflow contracts, not
  unreachable runtime modules.
- `server/src/seeds/p0-review-readiness.seed.ts` is imported by
  `server/prisma/seed.ts` and review E2E setup.
- Historical documents that name removed paths are explicitly labeled
  historical or superseded and are not current architecture maps.

Generated Prisma sources and `client/src/routeTree.gen.ts` were not edited or
treated as cleanup targets.

## Validation

The following commands were run after the read-only audit and passed:

```text
npm run test:architecture
✔ no dependency violations found (333 modules, 1333 dependencies cruised)
✔ no dependency violations found (389 modules, 1359 dependencies cruised)

npm run lint:ci --workspace client
exit 0; no ESLint errors or warnings

npm run typecheck --workspace client
exit 0

git diff --check
exit 0
```

Repository state remained clean apart from the addition of this report:

```text
branch: refactor/whole-workspace-architecture
audited HEAD: b3e4c5ba86e4e215f34646b5476974b66d5116ea
```

The full M10 verification evidence remains recorded in
[`migration-ledger.md`](./migration-ledger.md), including the exact Node 24 /
npm 11 check, server E2E, acceptance, live tutoring, fresh Compose/database,
blank migration/seed, catalog/drift assertions, generated ownership, and
obsolete-entry searches.

## Approval gate

No cleanup implementation has been performed. Owner approval is requested for
the following bounded actions:

1. Delete `instructor-dashboard.constants.ts`.
2. Remove `role-placeholder-page.tsx` and its unreachable test, moving any
   still-needed sign-out assertion to the auth owner first.
3. Decide whether the ITI probe/transport is a supported operational path. The
   recommendation is to retain the pair if it is supported, or remove both as
   one capability if it is not.
4. Decide whether the Python-only P0 references should remain as the explicit
   seeded-demo scope or be rewritten as a broader product-contract change.

Until that approval is given, this report is the complete cleanup deliverable
and the working tree will not be modified further.
