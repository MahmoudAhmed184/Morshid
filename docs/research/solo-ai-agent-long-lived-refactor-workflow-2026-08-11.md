# Solo AI-agent workflow for a long-lived refactor branch (2026-08-11)

**Research date:** 11 August 2026  
**Scope:** A solo developer coordinating AI coding agents for Morshid's broad,
whole-workspace architecture refactor on one long-lived branch  
**Status:** Planning evidence only; no application code was changed

## Executive recommendation

Keep the chosen **one long-lived refactor branch and one final PR**, but do not
treat either as one task, one working tree, or one giant commit. Operate the
branch as a private integration mainline:

1. Approve a short architecture charter and decision log before write-heavy
   work begins.
2. Divide work into bounded capability migrations with explicit path ownership,
   invariants, and acceptance checks.
3. Run read-heavy exploration, research, testing, and review in parallel.
4. Give each concurrent writer a separate Git worktree and child branch; if the
   available agent harness shares one checkout, allow only one writer at a time.
5. Land each finished task into the refactor branch as one or a few coherent,
   healthy commits after an independent read-only review.
6. Revalidate after every task and run full integration checkpoints throughout,
   not only immediately before the final merge.
7. Regularly merge `dev` into the refactor branch, then run the complete gate on
   the resulting integrated SHA.

This preserves the user's delivery choice while containing its main risks:
conflicting edits, hidden behavior changes, assumption drift, unreviewable diffs,
and late discovery of integration failures.

## What the current repository changes

- The checked-out branch is `feature/socratic-tutor-v1-phase2`; the user refers
  to this as Nourhan's branch. The workflow should use its exact remote branch
  name as the refactor integration branch once that identity is confirmed.
- `npm run check` is already the repository's canonical format, lint, type,
  unit-test, and build gate. See [`package.json`](../../package.json).
- The full GitHub workflow also deploys migrations and runs server E2E and
  browser acceptance suites. However, it runs on pushes only to `dev` and
  `main`, or on pull requests targeting them. A long-lived branch therefore
  gets continuous remote validation only if a draft PR is opened early or the
  workflow trigger is deliberately extended. See
  [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

Open a draft PR from the refactor branch to `dev` at the beginning. Its purpose
is continuous diff visibility and CI, not early merging.

## Evidence and operating consequences

### 1. Delegate independent work, not an undivided rewrite

Official OpenAI documentation says subagents are useful for bounded parallel
work and for keeping exploration logs and other noisy intermediate material out
of the main decision thread. It recommends starting with read-heavy parallel
tasks—exploration, tests, triage, and summaries—and explicitly warns that
parallel write-heavy work can create conflicts and coordination overhead. See
[OpenAI: Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

Consequences:

- A workstream must be independently describable and verifiable. Good units are
  “migrate review case creation behind the approved module boundary” or “map and
  characterize the notification dependency cycle,” not “organize the server.”
- Use parallel agents freely to map dependencies, inventory imports, research
  framework constraints, run disjoint test suites, or review finished work.
- Parallel implementation is allowed only when the tasks have disjoint owned
  paths and no shared contract is still being decided.
- Keep requirements, accepted decisions, integration order, and final synthesis
  in the coordinator's thread. Workers should return concise handoffs rather
  than raw logs.
- If two tasks depend on the same unsettled interface, settle that interface in
  an ADR or a small seam-establishing task first; the tasks are not yet truly
  independent.

### 2. Separate workspaces prevent physical interference; ownership prevents semantic interference

Git worktrees allow multiple branches to be checked out at once. OpenAI's Codex
worktree documentation describes them specifically as a way to run independent
chats in the same project without disturbing one another, and Git documents
that each linked worktree has its own `HEAD` and index while sharing repository
metadata. See [OpenAI: Git worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees)
and [Git: `git-worktree`](https://git-scm.com/docs/git-worktree).

A worktree does not make overlapping architectural edits independent. Adopt an
exclusive edit-ownership ledger:

| Asset | Ownership rule |
| --- | --- |
| A feature/module capability | One writer until its task is integrated |
| Root configuration and workspace manifests | Integration owner only |
| Shared contracts, public exports, and cross-feature primitives | Dedicated seam task, then integration owner |
| `package-lock.json` | Only the task explicitly authorized to change dependencies |
| Prisma schema and migrations | Dedicated database workstream; never mixed casually into folder moves |
| Generated Prisma code and `client/src/routeTree.gen.ts` | Generator-owned; never hand-edited |
| Research, tests, and review | May run concurrently when they do not mutate owned production paths |

When the current collaboration environment exposes one shared checkout to all
agents, worktrees are not implicit. In that case, serialize write agents and
use parallel agents only in read-only roles. Never ask multiple agents to “be
careful” while writing the same tree; that is not an ownership mechanism.

### 3. Make decisions durable before agents multiply them

Official OpenAI documentation says Codex reads applicable `AGENTS.md` files at
the start of a run and supports layered repository and directory-specific
instructions. This gives each new agent consistent repository rules, but the
instructions are loaded once per run, so an already-running worker should not
be assumed to have absorbed a later decision. See
[OpenAI: Custom instructions with `AGENTS.md`](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

AWS's ADR guidance defines an architecture decision record as the decision,
its context, and its consequences; accepted ADRs form an immutable decision log
and later changes supersede rather than silently rewrite old decisions. See
[AWS: Architectural decision record process](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html).

Use three versioned sources of truth:

1. **Architecture charter:** target principles, dependency direction, naming,
   folder thresholds, test placement, public APIs, compatibility policy, and
   generated-file rules. This is normative and concise.
2. **ADRs:** one per architecturally significant choice, recording context,
   considered alternatives, decision, consequences, status, and supersession.
3. **Migration ledger:** tasks, prerequisites, owned paths, base and integrated
   SHAs, status, validation evidence, and follow-ups. This is operational, not
   an alternative architecture document.

Put durable agent rules in `AGENTS.md` only after the human accepts them. Put
initiative-specific decisions in the charter/ADRs and link them from each task
brief. Restart or explicitly re-brief agents after a decision changes.

### 4. Give every agent a contract and require a structured handoff

OpenAI recommends narrow, opinionated custom agents with a clear job and a tool
surface that matches it, and says a good subagent request states how to divide
work and what result to return. Its examples separate exploration, review, docs
research, reproduction, and implementation roles. See
[OpenAI: Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

Every implementation task packet should contain:

- task ID, objective, and why it is independently safe;
- starting commit SHA and prerequisite task/ADR IDs;
- paths exclusively owned and paths explicitly forbidden;
- observable behavior to preserve and any approved behavior change;
- target dependency rule and public contract;
- exact focused tests and the integration gate required;
- permission to stop and propose a decision rather than invent one;
- required handoff format.

Every handoff should return:

- starting SHA and final commit SHA(s);
- changed, added, deleted, and generated files;
- behavior preserved or deliberately changed;
- decisions made within scope and open decisions deferred;
- exact commands run, their result, and tests not run;
- risks, surprising dependencies, and recommended next task;
- confirmation that forbidden paths and unrelated user changes were untouched.

The coordinator must inspect the diff and evidence. A polished agent summary is
not proof that the patch satisfies the task.

### 5. One final PR should still preserve small, coherent commits

Git's own patch-submission guidance says to make separate commits for logically
separate changes and notes that an overlong description often signals a commit
that should be split. See
[Git: Submitting patches](https://git-scm.com/docs/SubmittingPatches).

Google's engineering practices recommend one self-contained change with its
related tests, keeping the system working after it lands. They specifically
recommend separating refactors from feature/bug changes and adding
characterization tests before an uncovered refactor. They also note that
trusted automated moves can be larger, although merging and testing risks
remain. See
[Google: Small changes](https://google.github.io/eng-practices/review/developer/small-cls.html).

Apply these rules inside the long-lived branch:

- One commit should have one review story: characterization, seam, mechanical
  move, dependency inversion, behavior change, or cleanup.
- Keep a moved source file and its adjacent test together.
- Do not mix broad formatting with structural or semantic changes.
- Prefer rename-only commits before semantic edits when Git can preserve useful
  history and the intermediate state remains healthy.
- Every durable commit must compile and pass the focused tests for its scope.
  Temporary broken checkpoints may exist locally, but should be fixed or
  squashed before another task bases work on them.
- Preserve these bounded commits in the final PR. “One large merge” describes
  when the branch reaches `dev`; it does not justify one opaque commit.

### 6. Verification must be hierarchical and frequent

Fowler's branching guidance describes a healthy branch as one where automated
checks run on each commit. It also explains that low-frequency integration
makes conflicts larger and reveals them later; frequent integration reduces
their complexity and risk. See
[Martin Fowler: Patterns for Managing Source Code Branches](https://martinfowler.com/articles/branching-patterns.html).

Use this verification ladder:

1. **Worker loop:** formatting/type feedback and the smallest relevant unit or
   characterization tests after each meaningful edit.
2. **Task handoff:** all affected package tests, typecheck, and build; inspect
   rename/deletion summaries and search for stale import paths.
3. **Task integration:** independent review, integrate into the refactor branch,
   then rerun the focused checks against the integrated result.
4. **Milestone checkpoint:** `npm run check`, then applicable E2E and acceptance
   suites with deterministic infrastructure and seed data.
5. **Upstream checkpoint:** merge the latest `dev`, resolve conflicts, and run
   the full milestone gate again.
6. **Final candidate:** run all GitHub jobs on the exact final PR/merge candidate
   SHA and retain the results in the PR.

GitHub requires status checks on the latest applicable commit SHA; an earlier
green commit does not validate later edits. Strict checks can also require the
branch to be current with its base. See
[GitHub: Troubleshooting required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)
and [GitHub: Ruleset status-check behavior](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

Therefore “the branch passed last week” is not evidence for the final merge.

### 7. Review with an agent that did not implement the task

Official OpenAI documentation positions Codex review as another focused review
pass over a diff and recommends concise, consequential repository-specific
rules while leaving deterministic formatting and lint checks to CI. Its
subagent examples likewise separate a read-only reviewer from implementers. See
[OpenAI: Review GitHub pull requests with Codex](https://learn.chatgpt.com/docs/third-party/github)
and [OpenAI: Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

For each task, a fresh read-only reviewer should compare the diff against:

- the task packet and accepted ADRs;
- preserved external behavior and characterization tests;
- dependency direction and public exports;
- missing/weak tests and false-positive test rewrites;
- accidental edits outside ownership;
- security, data-migration, and operational risks where applicable.

The implementer may fix findings, but the coordinator decides disposition and
records it. Run broader branch-level reviews at architecture milestones and a
final two-axis review: conformance to repository/architecture standards and
conformance to the agreed refactor specification.

### 8. A long-lived branch needs explicit integration checkpoints

The user's solo status reduces human scheduling conflicts, but AI agents still
create concurrent authorship, separate contexts, and independent assumptions.
It does not remove integration risk. Fowler notes that branches diverge as they
run without integrating and recommends increasing integration frequency. See
[Patterns for Managing Source Code Branches](https://martinfowler.com/articles/branching-patterns.html).

Recommended cadence:

- integrate each approved child task immediately into the refactor branch;
- merge `dev` whenever it moves and at least at every completed capability;
- never begin a dependent task from a stale child branch;
- tag or record each green milestone SHA in the migration ledger;
- if the same upstream conflicts recur, Git's `rerere` can record and reuse
  resolutions, but every reused result still needs diff inspection and tests.
  See [Git: `git-rerere`](https://git-scm.com/docs/git-rerere).

Prefer merging `dev` into the published long-lived refactor branch over
repeatedly rewriting its history. Child task branches can be rebased or
discarded before integration because no downstream task should depend directly
on an unintegrated child branch.

## Proposed task state machine

```text
proposed
  -> researched/mapped
  -> decision-ready
  -> ADR/contract accepted
  -> assigned (paths leased, base SHA recorded)
  -> implemented + focused checks
  -> independent review
  -> revised/approved
  -> integrated into refactor branch
  -> integration checks green
  -> ownership released
```

A task cannot enter implementation while its public contract is unsettled, and
ownership cannot be released until the integrated checks—not merely the child
branch checks—pass.

## Suggested grill decisions

### Q12 — Where may AI agents write concurrently?

**Recommendation:** Separate worktree and child branch per writer, with disjoint
exclusive path ownership. If all agents share one checkout, serialize writers;
keep parallel agents read-only.

### Q13 — What is the architecture source of truth?

**Recommendation:** Approve a concise architecture charter plus immutable,
supersedable ADRs before implementation. Use a separate migration ledger for
task state and evidence. No worker may turn an unresolved design question into
an undocumented convention.

### Q14 — Who owns cross-cutting files and contracts?

**Recommendation:** The human/coordinator is the integration owner. Root config,
workspace manifests, lockfiles, shared contracts, public barrels, Prisma schema,
and other high-fan-in seams change only in dedicated tasks controlled by that
owner.

### Q15 — What must an agent deliver before integration?

**Recommendation:** One or a few coherent commits, the structured handoff above,
focused green checks, and a clean independent read-only review. Integrate only
after findings are resolved or explicitly accepted.

### Q16 — How often must the long-lived branch prove itself?

**Recommendation:** Focused checks at every task, `npm run check` at every
milestone, E2E/acceptance at capability and upstream-sync checkpoints, and the
complete GitHub workflow on the exact final candidate SHA. Open the draft PR
early so branch updates actually trigger existing CI.

## Bottom line

The safe interpretation of Q10 is:

> One long-lived **integration branch**, one final PR, many bounded task
> branches/worktrees, many coherent green commits, repeated upstream merges,
> and independent agent reviews.

Solo ownership makes decision authority simple. It does not make one shared
working tree, undocumented agent assumptions, an unreviewable commit, or a
single end-of-project test run safe.
