# PR #205 refactor review resolution

- Date: 2026-08-13
- Review source: `pr-205-refactor-review.md`
- Fix branch base: `origin/refactor/whole-workspace-architecture` at `a74ea16f`
- Target branch: `refactor/whole-workspace-architecture`

Every reported finding was reproduced or confirmed independently before its
correction. None of H1–L4 was disproven.

## Resolution table

| ID | Resolution | Regression or enforcement proof |
| --- | --- | --- |
| H1 | Refresh rotation and password reset/disable now serialize on the User row; rotation re-reads the token after the lock and rejects tokens older than the password epoch. | Real PostgreSQL reset/rotation interleaving proves no replacement token escapes. |
| H2 | Courses removal, Review resolution/rejection, and manual intake lock the same active membership row in their transaction before committing. | Three real PostgreSQL interleavings cover resolution, rejection, and manual intake against removal. |
| H3 | The debugging boundary is language-neutral and enforces only bounded input shape/size; diagnosis remains model-owned inside the unified workflow. | Golden JS, TS, Java, C, and Python fixtures plus E2E and browser coverage. |
| H4 | Conversations owns scalar transcript/session state behind `ConversationTurns`; Materials owns citation/source projection, Reviews owns review summaries, and application composition joins those views. | Architecture rules reject implementation reach-through; a negative fixture produced the expected Conversations violation. |
| H5 | First-message create/navigation/submit is awaited and lossless, retains one client message ID, reuses the created session on retry, and consumes the handoff only after the destination composer accepts it. | Navigation rejection and late destination-mount tests cover both failure paths. |
| M1 | `clientMessageId` is required; reuse with different content is a conflict. Retry addresses the exact Attempt and uses compare-and-set updates for both message pointers. | Missing-key, key-reuse, exact-target, simultaneous retry, stale retry, and concealment coverage. |
| M2 | Generated baselines are captured before generation, compared after one official generation, and then checked for second-run stability. | Marker fixture and subprocess proof fail nonzero when official generation removes a hand edit. |
| M3 | Catalog validation fingerprints enum order, index SQL, CHECK/FK definitions and actions, trigger SQL/flags, and function bodies. | Pure fixture/subprocess proofs and an actual same-named `CHECK (true)` database mutation fail nonzero. |
| M4 | Prisma behavior-spec exemption is removed; product behavior tests consume capability-owned values, and client feature rules derive from the filesystem. | Negative architecture proof rejects both a behavior-file Prisma import and a Conversations implementation import. |
| M5 | Ordinary Jest and Playwright gates force all four deterministic providers; live E2E has a separate opt-in bootstrap; Gate 2 overrides and asserts Analysis explicitly. | Full E2E and acceptance inventories run with ambient provider settings unable to select live adapters. |
| M6 | Message history follows updates only while the reader remains near the bottom; initial open and explicit send/retry preserve follow intent. | Poll-completion regression keeps a reader's scrolled position. |
| M7 | An explicit unavailable course ID produces an unavailable state instead of selecting another assigned course. | Routed unavailable-course workspace test. |
| M8 | The pass-through analysis-context repository and one-entry prompt registry are deleted; callers use the deep owner and immutable prompt definition directly. | Unit, architecture, and type checks cover the direct seams. |
| M9 | Non-authoritative Attempt claim/version/review/strategy fields and the dead failure API are removed from the schema, migration, repositories, and generated client. | Clean reset, generation, catalog, and drift checks validate the direct schema cutover. |
| L1 | Dead role placeholder, its test, the unused instructor constant, and the three superseded font packages are deleted. | Source/dependency searches and clean install/build. |
| L2 | The review list query is disabled while the inbox is closed; the unread indicator remains the sole background poll. | Closed/open control and disabled-hook tests. |
| L3 | Light-theme warning/gold foreground tokens now meet normal-text contrast for tinted and solid badges. | Contrast regression computes both required ratios at or above 4.5:1. |
| L4 | This branch uses scoped Conventional Commits and this document/PR body records the actual base, results, migration impact, UI scope, and two inherited unscoped commits. | Commit-range and PR-base checks before publication. |

## Architecture and migration implications

- The capability graph is now Conversations scalar state → application
  presentation composition ← Materials/Reviews projections. Tutoring consumes
  the one transaction-aware `ConversationTurns` interface and does not import
  Conversations persistence or HTTP implementation files.
- Courses owns the lock used to authorize Review commits. The same lock order is
  used by membership removal and review writes, keeping authorization current at
  commit time without a second membership implementation.
- The rolling initial migration is intentionally amended because the target
  refactor branch remains pre-release. Removed Attempt columns and indexes have
  no compatibility alias, fallback, or follow-up migration.
- Prisma and TanStack generated outputs remain generator-owned. Prisma output
  was regenerated only with the official command; the route tree was generated
  by the repository's route/build commands.

## Validation record

- Node `v24.19.0`, npm `11.17.0`: clean `npm ci` installed 1,431 packages;
  audit remained at the base branch's 16 advisories (5 moderate, 11 high).
- `npm run check`: formatting, strict lint, type checks, both dependency graphs,
  generated ownership, 15 root enforcement tests, 478 client tests, 1,231
  server tests, and both production builds passed.
- Deterministic E2E: 36 suites, 389 tests passed.
- Focused PostgreSQL concurrency and retry regression set: 4 suites, 48 tests
  passed.
- Deterministic Playwright acceptance: 30 Chromium journeys passed.
- Clean database: reset, sole migration, seed, semantic catalog assertion,
  deploy/status, and migration-directory drift diff passed; drift reported
  `No difference detected.`
- Negative enforcement: generated marker, weaker same-named CHECK, generated
  Prisma behavior import, and Conversations implementation reach-through all
  failed the corrected gates.
- `git diff --check` passed. The changed-UI detector reported only the two
  pre-existing patterns described below.

With the repository's Compose database/Redis URLs exported (and a fresh,
explicitly named shadow database supplied for the drift command), the exact
high-strength commands were:

```sh
npm ci --userconfig=/dev/null
npm run check
npm run test:e2e
npm run test:e2e --workspace=server -- --runInBand --runTestsByPath \
  test/identity/user-administration.persistence.e2e-spec.ts \
  test/reviews/instructor-review-action.persistence.e2e-spec.ts \
  test/reviews/review-persistence.e2e-spec.ts \
  test/tutoring/tutoring-turn.repository.e2e-spec.ts
npm run test:acceptance
MORSHID_RESET_CONFIRM=reset-local npm run db:reset
npm run db:seed
npm run db:migrate:deploy
npm exec --workspace server -- prisma migrate status --config prisma.config.ts
npm run db:assert-catalog
(cd server && npm exec -- prisma migrate diff --config prisma.config.ts \
  --from-migrations prisma/migrations --to-schema prisma --exit-code)
git diff --check
```

## UI scope

Visible changes are limited to the Student tutor/course/inbox behavior and the
light-theme warning/gold contrast correction. No new page or visual composition
was introduced. The UI detector reported two pre-existing patterns outside the
changed lines (one easing curve and one review side-border treatment); neither
is part of the reviewed findings or this patch's visual delta.

## Provenance disclosure

The target branch already contains two unscoped commits identified by the
review: `6b559c25` and `d78137b4`. They are inherited history and are not rewritten
by this fix branch. Every new commit in this branch uses a scoped Conventional
Commit subject.
