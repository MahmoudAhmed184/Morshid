# Morshid — Implementation Plan: Allowances + AI Capacity

This plan implements the resolved feature design without broad refactoring.

## Slice 1 — Domain language and allowance policy foundation

- Update `CONTEXT.md` with the resolved allowance/readiness terminology.
- Add ADR `docs/adr/0009-local-ai-capacity-observability.md`.
- Add the `allowances` server capability.
- Add deployment Policy Day time-zone configuration.
- Persist deployment defaults and Course Policy Overrides.
- Persist audited Allowance Reset records/cutoffs.
- Expose one small named interface that Tutoring and Reviews can use to resolve:
  - Policy Day window;
  - effective Course limit;
  - applicable reset cutoff.
- Default tutoring limit: 30.
- Default review limit: 3.
- Add Admin policy APIs and validation.
- Audit every policy mutation and reset.

### Tests

- Policy Day boundaries in `Africa/Cairo`.
- Course override precedence.
- `0` limit behavior.
- mid-day policy change semantics.
- reset cutoff semantics.
- Admin-only authorization.

## Slice 2 — Review Allowance correctness

Replace the current global UTC 3/day check.

- Preserve `STUDENT_REQUEST` as the chargeable manual trigger.
- Resolve Course and effective Review Allowance before admission.
- Lock on Student + Course + Review Allowance + Policy Day.
- Count only manual requests for that Course in the current Policy Day after the latest applicable reset.
- Keep automatic triggers free.
- Keep idempotent manual replay free.
- Preserve behavior where a Student manual trigger may be added to an already-existing automatic Review Case.

### Tests

- 3 accepted / 4th rejected.
- independent Course counters.
- automatic trigger costs zero.
- idempotent replay costs zero.
- existing automatic case + new manual request costs one.
- concurrency with one remaining.
- reset and next Policy Day.

## Slice 3 — Tutoring Allowance admission

Integrate allowance admission into the authoritative Student-turn creation path.

- Identify/reuse the existing identity that represents the same Student turn across replay/retry.
- Check idempotency before charging a second unit.
- Lock Student + Course + Tutoring Allowance + Policy Day.
- Count distinct chargeable Student turns after reset cutoff.
- Admit the new turn atomically with the limit check.
- Internal provider retry/failover does not charge.
- Product retry of an already-admitted failed turn does not charge.
- An admitted turn that later fails remains one consumed unit.

### Tests

- 30 accepted / 31st rejected.
- concurrency with one remaining.
- idempotency replay.
- provider retry/failover.
- failed-turn product retry.
- separate Courses.
- reset and next Policy Day.

## Slice 4 — Student Usage & Reviews UI

Replace the `/settings/usage` placeholder.

- Use selected Course context.
- Fetch Tutoring and Review allowance snapshots from their owning APIs.
- Show two allowance cards with used/limit, remaining, progress, reset time, time zone.
- Link reviews card to Student Review Inbox.
- Add compact chat warning at 1–3 remaining.
- Disable only *new* turns at zero; keep free retry available.
- Show review remaining on the manual-review action where useful.
- Disable manual Review Request at zero.

### Tests

- loading/error/empty Course.
- normal/low/exhausted states.
- reset time display.
- zero tutoring behavior preserves retry.
- zero reviews behavior.
- no AI/provider operational metadata appears to Students.

## Slice 5 — Read-only platform observers

### Gemini chat pool

Extend the pool seam with a credential-opaque read-only snapshot.

Snapshot must:

- report aggregate configured/available/cooling counts;
- optionally report earliest retry and aggregate last-rate-limit time;
- never call `select()`;
- never mutate the pool cursor/cooldown;
- never return project IDs, API keys, or state IDs/digests.

### Gemini embedding budget

Extend the quota seam with a read-only snapshot.

Snapshot must:

- report configured local dimensions and current use/remaining/recovery state;
- distinguish `exhausted` from `unavailable`;
- never reserve/debit quota;
- never return quota keys, credential digests, project identifiers, or credentials.

### Tests

Use mutation-detection/spies so observer tests prove state does not change.

## Slice 6 — Admin AI Capacity API

Add the `ai-capacity` capability with an Admin-only controller.

- Consume only sanitized platform observer ports.
- Build aggregate `Ready | Pressured | Blocked | Unknown` status.
- `Pressured` when any local numeric budget is >= 80% utilized or some chat projects are cooling while capacity remains.
- Never convert chat cooldown state into a fake quota percentage.
- Return safe partial data if one observer fails.
- Add `Cache-Control: no-store`.
- Do not call provider SDKs/network clients.

### Security tests

Assert serialized payload never contains:

- API keys or key fragments;
- project IDs;
- pool member/state IDs;
- digests;
- Redis keys;
- raw provider errors.

Assert zero upstream provider calls during endpoint tests.

## Slice 7 — Admin settings UI

### `/admin/settings/usage`

- edit deployment Tutoring Allowance;
- list Course overrides;
- create/edit/remove override;
- show effective values.

### `/admin/settings/review-policy`

- edit deployment Review Allowance;
- list Course overrides;
- create/edit/remove override;
- show effective values.

### `/admin/settings/ai-capacity`

- overall local readiness;
- Chat generation: aggregate pool availability;
- Embeddings: local budget dimensions;
- clear local-only disclaimer;
- partial/unknown states;
- no credential/project identifiers;
- no action that probes/resets/rotates provider state.

Use the existing admin workspace composition and keep route files thin.

## Slice 8 — Allowance Reset support UX

Add a bounded Admin support action reachable from the appropriate Student/Course administration context.

- select tutoring, review, or both;
- require reason;
- confirmation dialog;
- display current effective usage before reset;
- emit Audit Event;
- preserve history.

Do not place this control on AI Capacity.

## Slice 9 — Full validation

Run the repository's complete CI/check suite.

Also explicitly verify:

- architecture/dependency rules;
- route-deep-link tests;
- role boundaries;
- concurrency integration tests;
- no credential exposure snapshots;
- no-provider-call AI capacity test;
- no mutation from read-only observers;
- existing tutoring/review behavior outside the new policy remains unchanged.

## Definition of done

Do not mark complete with placeholders, hard-coded frontend counts, client-only limit enforcement, provider probes, fake provider quota percentages, or secret-bearing operational DTOs.

The final implementation must make the current glossary, Review implementation, settings routes, and AI platform behavior agree with one coherent product model.
