# Feature program contract

This file is the shared contract for F01 through F27. A feature brief may narrow
it but may not silently contradict it.

## Product boundary

- Students are primary. Instructors see assigned-course Materials, Review Cases,
  and aggregates derived only from Review Cases. They never browse unflagged
  Conversations.
- Admins control operational policy. No feature turns Morshid into a general
  LMS, answer generator, or generic notification platform.
- Preserve course isolation, `NO_FINAL_ANSWER`, citation provenance, the single
  Tutoring Runtime, and Reviews ownership of the Student Review Inbox.

## Ownership

- Identity owns profile, credentials, refresh sessions, and password policy.
- Conversations owns drafts that become messages, Conversation organization,
  and exports. Device-local drafts remain client state.
- Tutoring owns Tutoring Allowance policy and authoritative consumption.
- Reviews owns Review Allowance policy, Review Cases, Reviewed Guidance, and
  the Student Review Inbox.
- Materials owns upload policy and processing-failure state.
- Courses owns the archived-Course lifecycle and coordinates retention through
  small named interfaces supplied by affected capabilities.
- Audit owns immutable Audit Events and filtered export.
- Health presents safe operational snapshots from platform adapters.
- Role workspaces compose feature interfaces. Do not create a generic server
  Settings module or duplicate behavior under role folders.

The Policy Day clock is the one shared product seam for daily windows. It owns
the configured IANA time zone and returns exact window boundaries. Tutoring and
Reviews own their numeric policies and consumption.

## Settings information architecture

- Student: Account; Appearance & accessibility; Learning & language; Usage &
  reviews; Security.
- Instructor: Account; Appearance & accessibility; Workspace; Security.
- Admin: Account; Appearance & accessibility; Usage; Review policy; Materials
  & data; Security; AI capacity.

Settings use deep-linkable child routes, a vertical sub-navigation on desktop,
and an accessible compact selector on mobile. Existing Morshid tokens,
typography, cards, form controls, and page hierarchy remain the visual authority.

## Fixed policy defaults

| Policy | Default | Allowed values |
|---|---:|---:|
| Policy Day time zone | `Africa/Cairo` | Valid IANA time zone |
| Tutoring Allowance | 40 turns per Student and Course per Policy Day | 1 to 500 |
| Deployment tutoring cap | 1,000 turns per Policy Day | 1 to 100,000 |
| Review Allowance | 3 requests per Student and Course per Policy Day | 1 to 20 |
| PDF upload size | 10 MB | 1 to 100 MB |
| Archived-Course retention | 90 days | 30 to 365 days |
| Refresh-session lifetime | 7 days | 1 to 30 days |
| Password minimum | 15 characters | Fixed security floor |

A Course Policy Override wins over its deployment default. Numeric changes
apply to the next decision, never revoke existing domain records, and create an
Audit Event with actor, scope, old value, new value, and reason. A Policy Day
time-zone change activates at the next boundary under the old time zone so it
cannot create a second partial-day allowance.

## Allowance rules

- Count one unique Tutoring Attempt immediately before it enters the AI
  pipeline. Validation failures, authorization failures, unavailable course
  evidence, and idempotent replays consume nothing. Provider failures and safe
  fallbacks consume the reservation.
- Count one unique manual Student review request. Automatic triggers and
  idempotent replays consume nothing.
- Return the effective limit, used count, remaining count, and exact reset time
  to authorized callers. Never reveal another Student's consumption.
- Return HTTP 429 with a stable error code and `Retry-After` when a limit blocks
  work. Distinguish Student, Course, deployment, and transport throttles without
  exposing institution-wide counts to Students.
- An Allowance Reset clears current consumption only. It never deletes Tutoring
  Attempts, Review Cases, messages, or Audit Events.

## Shared UX contract

- Show the effective value and whether it is inherited before an Admin edits a
  policy. Destructive actions show an impact preview and require confirmation.
- Every asynchronous view has loading, empty, error, retry, success, stale-data,
  and permission-denied behavior where applicable.
- Core journeys meet WCAG 2.2 AA, keyboard and screen-reader operation, visible
  focus, status announcements, 200% text resize, and 320 CSS-pixel reflow.
  Interactive targets remain at least 44 by 44 CSS pixels unless an inline-text
  control requires a standards-defined exception.
- English and Arabic layouts set document language and direction. User content
  with unknown direction isolates itself from surrounding UI.
- Never expose secrets, token hashes, system prompts, private review evidence,
  raw provider responses, or unflagged Student content.

## Persistence

- Server: identity data, language, policies, consumption, pins, archives,
  Reviewed Guidance, session families, and Audit Events.
- Device: theme, palette, text scale, density, motion, unsent drafts, active
  Instructor course, and saved review filters. Namespace device state by user.
- PostgreSQL is authoritative for product policy and allowance consumption.
  Redis handles short-lived request throttling, provider quota coordination,
  and cache-like operational state.

## Delivery discipline

1. Work only on operator-selected feature briefs. Start each feature branch from
   `feat/quality-of-life` after its dependencies have merged there, then return
   it through a pull request to that integration branch.
2. Inspect current code and tests before choosing names or locations. Follow an
   existing pattern before adding an abstraction.
3. Add focused behavioral tests. Include E2E or acceptance coverage when the
   feature crosses persistence, authorization, or a primary user journey.
4. Regenerate Prisma and TanStack outputs through repository commands. Never
   hand-edit generated code.
5. Update affected developer and product documentation when behavior changes.
6. Finish only after `npm run check` passes. Run relevant E2E and acceptance
   suites for the changed behavior.
