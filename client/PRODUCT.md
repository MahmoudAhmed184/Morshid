# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Students are the primary users. They use Morshid while learning from assigned
course material and need help reasoning without receiving assessed solutions.
Instructors provide bounded oversight for assigned courses. Administrators
manage accounts, courses, operational policy, and system health.

## Product Purpose

Morshid helps Students reason from course material through Socratic guidance,
citations, debugging guidance, and Instructor review. A successful release is
polished enough for a graduation demonstration and complete enough for a
controlled institutional pilot.

## Positioning

Morshid combines course-isolated retrieval, enforced solution withholding, and
human review. It is a focused tutoring platform, not a general chatbot, answer
generator, or learning-management system.

## Operating Context

Students work in private, Course-scoped Conversations. Instructors manage
Materials and Review Cases for assigned Courses without browsing unflagged
Conversations. Administrators configure deployment defaults and Course Policy
Overrides, then inspect Audit Events and operational health.

## Capabilities and Constraints

- Preserve the `NO_FINAL_ANSWER` policy, course isolation, citation provenance,
  and the single Socratic Workflow.
- Keep unflagged Student Conversations private from Instructors.
- Treat daily Tutoring and Review Allowances as Policy Day rules with explicit
  reset times and audited administrative changes.
- Keep behavior in its owning capability. Role workspaces compose capability
  interfaces; settings are not a generic server-side capability.
- Use strict TypeScript, thin TanStack routes, NestJS capability modules,
  PostgreSQL for authoritative product state, and Redis for short-lived
  coordination and request throttling.
- Support English and Arabic with complete right-to-left behavior.

## Brand Commitments

The product name is Morshid (مرشد, Arabic for guide or advisor). The interface
uses a calm academic voice and the existing Morshid visual identity. Future
work extends the incumbent design rather than replacing it without an explicit
redesign decision.

## Evidence on Hand

The repository contains a seeded Python course, deterministic tutoring and
review fixtures, a 65-item golden evaluation dataset, role acceptance journeys,
course PDFs, Morshid logos, and an existing light/dark palette system. Product
claims must use this evidence and must not invent institutions, users, outcomes,
or benchmarks.

## Product Principles

- Student reasoning comes before answer delivery.
- Official Course Materials outrank model output and Reviewed Guidance.
- Human oversight stays narrow, visible, and accountable.
- Limits explain what happened and when access returns.
- Operational controls expose effective policy without exposing secrets.

## Accessibility & Inclusion

Core journeys target WCAG 2.2 AA. They support keyboard operation, screen
readers, visible focus, 200% text resize, 320 CSS-pixel reflow, reduced motion,
and English and Arabic layouts without using color as the only carrier of
meaning.
