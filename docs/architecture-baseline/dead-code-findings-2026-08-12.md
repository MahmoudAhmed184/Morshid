# Dead, unused, and unwired-code audit

- **Status:** Completed & Reconciled (2026-08-15)
- **Audit date:** 2026-08-12 (Africa/Cairo)
- **Reconciliation date:** 2026-08-15
- **Audited branch:** `refactor/whole-workspace-architecture`
- **Audited SHA:** `b3e4c5ba86e4e215f34646b5476974b66d5116ea`
- **Source SHA:** `22fc7fbdce59fb2248db39a1bfd7b4d0b86f0480`

This report records the post-refactor dead-code audit and its reconciliation in the codebase.

## Executive result

The dependency graph has zero violations. The audit identified two client dead-code items and one platform transport adapter:

1. **DC-001 (`instructor-dashboard.constants.ts`)**: **RESOLVED (Deleted).** Deleted the unused constants file from `client/src/workspaces/instructor/dashboard/`.
2. **DC-002 (`role-placeholder-page.tsx`)**: **RESOLVED (Deleted).** Removed the unwired placeholder component and its test. Live protected routes resolve directly to role workspaces.
3. **UW-001 (`iti-gateway-transport.ts`)**: **RESOLVED (Retained).** Retained the transport to run the probe script `server/scripts/iti-bedrock-embedding-contract-probe.mts` with `npm run test:iti-bedrock-embedding:probe`.

No obsolete tutoring execution path remains in source, tests, scripts, or client code. Diagnosis behavior runs through the single `TutoringRuntime` and unified Socratic workflow ([ADR 0002](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0002-one-tutoring-runtime-and-attempt.md)).

## Audit method

The audit inspected four read-only scopes across the repository:

1. NestJS server modules, providers, exports, platform adapters, and legacy tutoring names.
2. Client routes, workspaces, features, components, hooks, and test-only imports.
3. Package scripts, Prisma, Docker Compose, CI workflows, fixtures, tests, and documentation references.
4. Diagnosis call graph, debugging contract, deterministic adapter, production model path, response governance, and course evidence boundary.

The audit verified references using symbol searches, dependency-cruiser graphs, import tracing, and automated test checks.

## Findings and resolution status

### DC-001. Unused instructor dashboard constants
- **Classification:** Confirmed dead code
- **Status:** **RESOLVED (Deleted)**
- **Path:** `client/src/workspaces/instructor/dashboard/instructor-dashboard.constants.ts`
- **Resolution:** Deleted. Symbol `reviewQueueFilters` had no consumer. The live dashboard composes `DashboardReviewQueuePanel` directly without depending on these values.

### DC-002. Test-only role placeholder page
- **Classification:** Unwired production component
- **Status:** **RESOLVED (Deleted)**
- **Path:** `client/src/features/auth/routing/role-placeholder-page.tsx`
- **Resolution:** Deleted. Removed the unreachable component and its test. Live routes resolve directly to workspace pages (`/chat`, `/instructor`, `/admin`).

### UW-001. ITI gateway transport
- **Classification:** Supported platform adapter for operational contract probe
- **Status:** **RESOLVED (Retained)**
- **Path:** `server/src/platform/ai/upstream/iti-gateway-transport.ts`
- **Resolution:** Retained. The transport is wired to `server/scripts/iti-bedrock-embedding-contract-probe.mts` and executed through `npm run test:iti-bedrock-embedding:probe` to validate the upstream ITI Bedrock contract.

## Diagnosis-path result

The unified diagnosis path is active:
- `TutoringRuntime` is the public tutoring seam, implemented by `TutoringRuntimeApplication`.
- Standard requests and code-diagnosis requests follow the same `SocraticWorkflow` path.
- `CODE_DIAGNOSIS` and `DEBUGGING_ISSUE` are domain values, and `DEBUGGING_GUIDANCE` selects `TRACE_EXECUTION` through the tutoring policy contract.
- The deterministic TutorModel adapter emits contract-valid debugging guidance fixtures for deterministic tests.
- Course evidence passes through the Materials `CourseEvidence` boundary, and safety and source-conflict checks run in the Tutoring response-governance path.
- Old paths (`GroundedChatService`, `SocraticChatOrchestrator`, `CompletionProvider`/`CompletionModule`, public `OutputPolicy`, Python Tutor runtime) are absent.

## Excluded false positives

The following files were traced and confirmed as active code:
- `client/src/components/branding/get-user-initials.ts`: used by the authenticated sidebar and account settings.
- `client/src/features/chat/sessions/chat-scope.ts`: used by Student session and message hooks.
- `client/src/features/reviews/interface/student-flag-reason.ts`: used by the Instructor review queue and detail pages.
- `client/src/lib/env.ts`: used by application composition.
- `server/src/modules/conversations/conversation-records.ts`: shared domain record contract used by Conversations and Tutoring.
- `server/src/seeds/p0-review-readiness.seed.ts`: imported by `server/prisma/seed.ts` and review E2E setup.

## Validation

All verification checks pass:
- `npm run check` (Prettier, ESLint CI, TypeScript, dependency-cruiser, generated ownership, unit tests, build).
- `npm run test:architecture` (Zero dependency violations).
- `npm run test:e2e` (Server integration tests).
- `npm run test:acceptance` (Playwright browser acceptance tests).
