# F21: Reviewed Guidance Library

**Difficulty:** Very hard  
**Dependencies:** None

## Outcome

Give Instructors a Course-scoped, versioned library of guidance they have
explicitly approved or authored.

## Contract

- Use the canonical term `Reviewed Guidance Entry`; do not call entries answers
  or answer keys.
- An assigned Instructor can create an entry explicitly from a resolved Review
  Case's published guidance or author one manually. Nothing enters the library
  automatically.
- Store Course, title, guidance content, optional source Review Case, author,
  current version, lifecycle state, and timestamps. Title is 3 through 160
  characters; content is 1 through 5,000 characters.
- Lifecycle states are Active, Needs revalidation, Withdrawn, and Superseded.
  Edits create immutable versions; supersession links the replacement.
- Any official Material becoming Ready, archived, deleted, or replaced marks
  active entries for that Course as Needs revalidation. An Instructor can
  revalidate, edit, supersede, or withdraw them.
- Every mutation uses optimistic versioning and an Audit Event. Only assigned
  Instructors can read or mutate library content.
- The Tutoring Runtime and retrieval pipeline do not read this library yet.

## Acceptance criteria

- [ ] Entry creation is always an explicit confirmed action.
- [ ] Review-derived entries preserve provenance without exposing private
      evidence outside existing Review permissions.
- [ ] Version history is immutable and lifecycle transitions are validated.
- [ ] Material changes mark the correct Course entries once and are atomic with
      the catalog transition where required.
- [ ] Search, filter, empty, conflict, revalidation, and withdrawn states are
      accessible.
- [ ] Privacy and E2E tests prove Course isolation and no retrieval use.

## Out of scope

Second-tier RAG, automatic publishing, Student browsing, bulk approval, and
ranking Reviewed Guidance against official Materials.

