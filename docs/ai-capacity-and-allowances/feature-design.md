# Morshid — Student Allowances and Admin AI Capacity

Status: **Resolved design**
Target: ITI graduation project
Basis: current `dev` repository state plus the `/grill-with-docs` session.

## 1. Goal

Finish the settings surfaces already scaffolded in Morshid so that:

- Students can understand their own daily tutoring and instructor-review allowances.
- Admins can configure product allowances at deployment-default and course-override level.
- Admins can inspect AI readiness and local capacity pressure without sending provider probes and without exposing credentials or provider identifiers.

This feature deliberately separates **student entitlement** from **provider capacity**. A student's allowance must never be derived from Gemini quota or current pool pressure.

## 2. Existing surfaces to finish

Do not add another top-level area.

### Student

`/settings/usage` — **Usage & reviews**

A read-only view of the signed-in student's effective allowance and consumption for the selected Course.

### Admin

`/admin/settings/usage` — **Usage**

Manage the default Tutoring Allowance and Course Policy Overrides.

`/admin/settings/review-policy` — **Review policy**

Manage the default Review Allowance and Course Policy Overrides.

`/admin/settings/ai-capacity` — **AI capacity**

Read-only local operational view of AI readiness, chat-pool availability, and embedding budget pressure.

## 3. Product allowance model

### Policy Day

Daily product allowances use one deployment-configured IANA time zone.

- Production/demo deployment: `Africa/Cairo`.
- Development/test may default to `UTC`.
- The Admin UI shows the configured time zone but does not change it at runtime.
- The Student UI shows the next reset time clearly.

This is intentionally independent of provider accounting windows.

### Tutoring Allowance

Default: **30 Student turns per Course per Policy Day**.

The number 30 is a product default for the graduation deployment, not a Gemini quota calculation. Admins may change it.

One unit is consumed when a **new Student turn is admitted for AI tutoring**.

The following do **not** consume another unit:

- an idempotent replay of the same Student submission;
- provider retry/failover inside the same turn;
- retrying the same failed Student turn through the product retry path;
- a request rejected before tutoring admission.

A turn that was admitted but later fails still counts once. Its retry is free. This keeps accounting stable and avoids compensation/debit rollback races.

The allowance is scoped by:

`Student + Course + Policy Day`

It is not global across all Courses.

### Review Allowance

Default: **3 manual Review Requests per Course per Policy Day**.

Only a Student-initiated manual Review Request consumes one unit.

Automatic review triggers never consume the Student's allowance.

Idempotent replay of the same manual request does not consume twice.

If a Student manually requests review for a message that already has an automatic Review Case, attaching the Student's manual request still consumes one unit because it creates real Instructor-review demand from that Student.

The allowance is scoped by:

`Student + Course + Policy Day`

This intentionally replaces the current actor-global UTC-day behavior.

## 4. Admin policy rules

### Tutoring limits

- Deployment default: 30.
- Course override replaces the deployment default while it exists.
- Valid range: `0..500`.
- `0` disables new AI tutoring turns for that Course.
- No "unlimited" mode.

### Review limits

- Deployment default: 3.
- Course override replaces the deployment default while it exists.
- Valid range: `0..20`.
- `0` disables Student-requested manual review for that Course.
- Automatic review still works.
- No "unlimited" mode.

### Mid-day changes

A policy edit takes effect immediately.

Existing consumption is not rewritten. If the new limit is below current consumption, remaining becomes zero until the next Policy Day or an audited Allowance Reset.

### Allowance Reset

Admins may reset one Student's current-Policy-Day consumption for one Course:

- tutoring only;
- review only;
- or both.

A reset:

- requires a reason and confirmation;
- is audited;
- does not delete Tutoring Attempts, Review Cases, Review Triggers, or Audit Events;
- makes subsequent allowance calculation count only relevant consumption after the latest applicable reset.

This is a support operation, not a way to change provider quota.

## 5. Student experience

### Usage & reviews page

The page uses the Student's active/selected Course context.

Show two primary cards.

#### Tutoring today

Show:

- used / limit;
- remaining;
- progress;
- next reset time;
- configured Policy Day time zone.

Supporting copy should make the mental model clear:

> Retries of the same tutoring turn do not use another turn.

#### Instructor reviews today

Show:

- used / limit;
- remaining;
- progress;
- next reset time;
- link to the Student Review Inbox.

Supporting copy should make clear that automatic review triggers do not consume the allowance.

### Chat integration

Do not permanently clutter the composer with quota UI.

- When 4+ tutoring turns remain: no special warning.
- When 1–3 remain: show a compact "X tutoring turns left today for this course" warning.
- At 0: disable new-turn submission and show the exact reset time.
- Product retry of an already-admitted failed turn remains available at 0 because it does not consume another unit.

### Review action integration

Where the Student can request Instructor review:

- show remaining count when useful, for example `Request review · 2 left`;
- at 0, disable the action and show the reset time;
- never describe an automatic review trigger as consuming a Student flag.

### What Students must not see

Students never see:

- tokens;
- provider names;
- model names;
- Gemini project/key-pool state;
- provider rate-limit information;
- other Students' consumption;
- credential-derived identifiers.

## 6. Product allowance enforcement

Product allowances are authoritative in PostgreSQL, not Redis.

Why:

- the actions being counted already have authoritative product records;
- allowance history must survive Redis eviction/restart;
- support reset and auditing belong with durable product state.

### Concurrency

Enforcement is server-side.

For each allowance type, use a transaction-scoped lock or equivalent serialization key containing:

`Student + Course + Allowance Type + Policy Day`

The limit check and authoritative record creation/admission must occur in one critical section.

Client-side remaining counts are informational only.

### Tutoring admission

Before creating/admitting a new Student turn:

1. resolve effective Course policy;
2. resolve Policy Day boundaries;
3. lock the allowance key;
4. count distinct chargeable Student turns since the applicable reset cutoff;
5. reject if exhausted;
6. create/admit the authoritative turn atomically.

Idempotency must be resolved before charging a second unit.

### Manual review admission

Migrate the current quota logic so it:

- locks by Student + Course + Review Allowance + Policy Day;
- filters `STUDENT_REQUEST` consumption by Course;
- uses Policy Day boundaries rather than hard-coded UTC;
- honors the latest applicable Allowance Reset;
- preserves existing idempotency behavior.

## 7. Product allowance errors

Do not reuse provider quota terminology.

Use product errors such as:

- `TUTORING_ALLOWANCE_EXHAUSTED`
- `REVIEW_ALLOWANCE_EXHAUSTED`

The response should include enough structured information for UI recovery:

- Course;
- effective limit;
- used;
- remaining;
- `resetAt`;
- Policy Day time zone.

A provider `429 RESOURCE_EXHAUSTED` is a different concern and must not leak through as a Student allowance error.

## 8. AI Capacity: operational contract

The Admin AI Capacity page is **read-only**.

It must never:

- call Gemini/Bedrock/another AI provider merely to check health;
- make a synthetic generation or embedding request;
- advance the Gemini chat pool cursor;
- reserve/debit an embedding quota bucket;
- clear cooldown state;
- reset a quota counter;
- rotate or enable/disable credentials.

### AI Readiness

**AI Readiness** means Morshid's locally derived ability to admit the AI work required for supported product flows.

It is not a claim that an external provider is reachable right now.

Overall status:

- **Ready** — required local configuration/coordination is readable and no material local pressure currently blocks the required AI paths.
- **Pressured** — useful capacity remains, but a local budget is at least 80% utilized or some chat-pool members are cooling down.
- **Blocked** — a required AI path cannot currently admit work because its locally enforced budget is exhausted, all relevant chat projects are cooling, or a required fail-closed coordination dependency is known unavailable.
- **Unknown** — the observer cannot safely determine state. The response remains sanitized and partial rather than guessing.

The page must visibly state:

> Local operational state only. Morshid does not probe AI providers from this page.

## 9. Chat generation capacity

The current Gemini chat path is a project pool that passively learns about provider rate limits during real tutoring traffic.

Show only aggregate operational state:

- provider: Gemini;
- configured project count;
- available count;
- cooling-down count;
- earliest local retry time when all/some projects are cooling;
- optional aggregate `lastRateLimitedAt` if it can be recorded without identifying a project.

Do **not** present a percentage such as "Gemini quota 72%" because Morshid does not have authoritative numeric remaining quota for chat.

### Required platform change

Add a **read-only snapshot operation** to the chat-pool seam.

It must inspect the existing Redis state without:

- selecting a project;
- changing round-robin position;
- creating/updating cooldown state;
- exposing project IDs, API keys, or state digests.

Do not implement Admin observation by calling the existing `select()` method.

## 10. Embedding capacity

Morshid already has explicit local Gemini embedding budget caps.

Show them as **Local embedding budget**, never as "Google quota remaining."

For each configured dimension, expose sanitized utilization:

- requests / minute;
- input tokens / minute;
- requests / hour;
- requests / day;
- requests / local 30-day window.

For a dimension expose:

- used;
- limit;
- remaining;
- utilization;
- reset/recovery time where meaningful;
- state: available / pressured / exhausted / unavailable.

Keep "budget exhausted" separate from infrastructure/configuration failure.

### Required platform change

Add a **read-only snapshot operation** to the quota seam.

It must read current Redis accounting without:

- reserving requests;
- debiting tokens;
- changing bucket/window state;
- exposing quota keys, credential digests, project IDs, or credentials.

The UI must not imply the local day/30-day windows match Google AI Studio accounting.

## 11. Credential and privacy boundary

The Admin capacity DTO is an explicit allowlist.

Never return or render:

- API keys or partial key suffixes;
- credential hashes/digests;
- Gemini quota project IDs;
- chat pool project/member IDs;
- Redis keys or state IDs;
- raw environment values;
- raw provider error payloads;
- request/response bodies from provider traffic;
- URLs that can contain credentials or sensitive query parameters.

Model names and provider names are acceptable operational metadata.

Responses use `Cache-Control: no-store`.

Only Admins may access the capacity/policy endpoints.

Read-only capacity views do not need Audit Events. Policy changes and Allowance Resets do.

## 12. Failure behavior

### AI Capacity endpoint

The operational page should degrade gracefully.

If one observer fails:

- return the safe portions that are still known;
- mark the affected section `Unknown` or `Blocked` according to what is actually known;
- never substitute invented values;
- never expose the underlying exception or secret-bearing state.

A Redis outage that is known to make the active AI adapter fail closed should be represented as blocked for that path.

### Student allowance endpoint

Allowance accounting uses PostgreSQL. A Redis outage does not change a Student's allowance usage.

The tutoring runtime may still be unavailable because its AI coordination path is blocked; that operational failure is separate from Student allowance exhaustion.

## 13. Server capability ownership

Add a cohesive **Allowances** product capability.

It owns:

- Policy Day calculation;
- deployment defaults;
- Course Policy Overrides;
- Allowance Reset records/cutoffs;
- the interface used by Tutoring and Reviews to resolve effective policy/window/reset information.

Tutoring continues to own tutoring consumption/admission.

Reviews continues to own review consumption/admission.

This avoids a "usage" module reaching into both capabilities to count their internal records.

Add a separate **AI Capacity** capability for the Admin operational API. It consumes sanitized, read-only observer ports implemented by the AI platform.

Do not put Student allowance policy into `platform/ai`.

## 14. API shape

Exact route naming may follow the repo's controller conventions, but preserve these ownership boundaries.

### Student-facing

Tutoring capability:

`GET .../tutoring/allowance?courseId=...`

Reviews capability:

`GET .../reviews/allowance?courseId=...`

Each returns:

- `limit`
- `used`
- `remaining`
- `resetAt`
- `policyTimeZone`

The client Usage & Reviews feature composes the two snapshots.

### Admin policy

Allowances capability supports:

- read/update deployment defaults;
- read/create/update/delete Course Policy Overrides;
- create an audited Student/Course Allowance Reset.

### Admin AI capacity

`GET .../admin/ai-capacity`

Returns a credential-opaque, aggregate local snapshot and uses `Cache-Control: no-store`.

## 15. Frontend ownership

Follow the existing thin-route architecture.

- `features/allowances`: reusable allowance queries/contracts/components.
- Student workspace: composes Usage & Reviews.
- Admin workspace: composes Usage and Review Policy controls.
- `features/ai-capacity`: admin AI-capacity query/contracts/presentation primitives.
- Admin workspace: composes the AI Capacity settings page.
- Route files remain thin.

## 16. Acceptance criteria

The feature is complete only when all of the following are true.

### Allowances

- 30th default tutoring turn for a Course/Policy Day is admitted; the 31st new turn is rejected.
- Two concurrent new turns with one remaining cannot both be admitted.
- Same client-message replay does not consume twice.
- Provider retry/failover does not consume twice.
- Product retry of the same failed turn does not consume twice.
- A second Course has an independent allowance.
- A new Policy Day resets effective usage.
- Three default manual Review Requests are accepted; the fourth is rejected.
- Automatic review triggers consume zero.
- Review requests are per Course, not global.
- Course override `0` disables the relevant Student action.
- Changing a limit mid-day changes remaining immediately without rewriting history.
- Allowance Reset restores current-day capacity without deleting historical records and emits an Audit Event.

### AI Capacity

- Loading or refreshing the page makes zero provider calls.
- Chat pool observation does not advance selection/cursor or mutate cooldown.
- Embedding observation does not reserve/debit a budget.
- A payload can never contain credentials, project IDs, state IDs/digests, Redis keys, or raw provider errors.
- Some chat members cooling => Pressured, not false "quota remaining."
- All chat members cooling => Blocked with a local retry indication.
- Embedding utilization >= 80% => Pressured.
- Local embedding exhaustion => Blocked for the required embedding path.
- Observer failure returns a safe partial Unknown/Blocked result rather than secrets or fabricated health.
- Student/Instructor roles cannot access Admin AI Capacity.
- Admin policy mutations are audited.
- Existing route ownership and architecture tests remain green.

## 17. Graduation-demo story

This feature gives the graduation discussion a strong systems story without adding fake complexity:

1. A Student can see that tutoring and Instructor-review access are fair, understandable product policies.
2. An Admin can control those policies per Course.
3. Morshid keeps product entitlement independent from volatile AI-provider capacity.
4. The AI Capacity page shows real local operational pressure gathered from production paths without generating synthetic provider traffic.
5. The design preserves credentials by construction: the observer interfaces never need to return them.
6. Concurrent allowance admission is enforced server-side, so the UI is not the security boundary.

That demonstrates product design, distributed coordination, security boundaries, concurrency control, observability, and human-review governance in one coherent feature.
