# Antigravity implementation prompt

Use this prompt once per feature. In Antigravity, select **Gemini 3.7 Flash High**
when the installed model selector exposes it. If High is unavailable, use the
available Gemini 3.7 Flash option and keep the feature scope unchanged.

Replace `<FEATURE_FILE>` with one path from the catalog, for example
`docs/feature-planning/features/f12-student-draft-autosave.md`.

The integration branch is `feat/quality-of-life`. Derive the feature branch
from the selected brief, using `feat/qol-fNN-<short-slug>`. For the example
above, use `feat/qol-f12-student-draft-autosave`.

## Prompt

```text
Implement exactly the Morshid feature described in @<FEATURE_FILE>.

Use this Git workflow before editing:
1. Inspect git status and preserve unrelated work.
2. Fetch origin, switch to feat/quality-of-life, and update it with a fast-forward
   pull from origin.
3. Confirm that every dependency named by the feature brief is already merged
   into feat/quality-of-life.
4. Create feat/qol-fNN-<short-slug> from the updated integration branch. Never
   implement the selected feature directly on feat/quality-of-life or dev.

Read these authorities completely before editing:
@AGENTS.md
@CONTEXT.md
@client/PRODUCT.md
@docs/feature-planning/program-contract.md
@<FEATURE_FILE>

Also read every dependency brief named by the selected feature. Inspect the
current implementation, tests, accepted ADRs, and package types instead of
assuming the brief's likely file locations are still current.

Work only on this vertical slice. Preserve course isolation, unflagged Student
privacy, NO_FINAL_ANSWER, the single Tutoring Runtime, Reviews ownership of the
Student Review Inbox, thin routes, capability ownership, and existing unrelated
work. Do not implement anything from deferred-work.md.

Before changing code, state:
1. whether every dependency is present in the current tree;
2. which existing module owns the behavior and which interface will change;
3. the focused tests that will prove the acceptance criteria;
4. any direct contradiction between the brief and current accepted ADRs.

If a dependency is absent or an accepted ADR directly contradicts the feature,
stop and report the exact blocker. Otherwise implement the smallest complete
solution. Keep one path: remove replaced hardcoded or duplicate behavior. Use
strict TypeScript and the repository's existing patterns. Never hand-edit
client/src/routeTree.gen.ts or server/src/generated/prisma.

Test observable behavior through the owning interface. Cover authorization,
course isolation, validation, error states, concurrency or idempotency where the
brief requires them, and the relevant accessible UI states. Generate owned
artifacts through repository commands.

Run focused checks while working. Before finishing, run npm run check and every
E2E or acceptance suite required by the feature brief. Update affected product
or developer documentation when the implemented behavior makes it stale.

After every required check passes:
1. Commit only the selected feature with a scoped Conventional Commit.
2. Push the feature branch to origin.
3. Open a pull request whose base is feat/quality-of-life and whose head is the
   feature branch. Include the feature ID, acceptance criteria, and test results
   in the pull request body.
4. Merge that pull request only after its required GitHub checks pass. If a
   check is pending, unavailable, or failing, leave the pull request open and
   report its URL and state.

Finish with:
- the behavior delivered;
- the important interface and persistence decisions;
- tests and commands run with their results;
- any acceptance criterion not met;
- files changed, grouped by capability.
```

## Operator rule

Start a fresh Antigravity task for each feature. Follow the dependency-aware
order in [`implementation-ease.md`](implementation-ease.md), but implement only
the features the operator selects. Each selected feature must complete its own
branch and pull request before the next dependent feature starts. Do not ask one
model run to implement the entire packet.
