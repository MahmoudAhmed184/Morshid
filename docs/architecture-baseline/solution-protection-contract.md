# Solution protection contract

Solution protection is Topic-owned provenance, not a synonym for the current
message's `requestKind`. A Topic is `UNKNOWN`, `UNPROTECTED`, or `PROTECTED`.
Each tutoring attempt persists the immutable effective decision it used.

Authoritative task metadata, an explicit protected-solution request, or an
accepted non-fallback task analysis on a newly resolved Topic can establish
`PROTECTED`. Accepted non-fallback conceptual analysis on a newly resolved
Topic can establish `UNPROTECTED`. `UNKNOWN` is screened conservatively.
`PROTECTED` is never downgraded in place. Switching through authoritative
Topic identity creates or activates another Topic and recomputes from that
Topic's provenance; restoring a protected Topic restores its protection.

The deterministic classifier remains a current-request signal only. Teaching
strategy, `requestKind`, `RevealPolicy`, and `TopicState` are not protection
provenance.

## Known topic-switch limitation

Free-text claims that the student changed subjects do not constitute an
authoritative Topic switch when no stable `topicId`, `problemId`, or
`conceptId` resolves the new subject. In that case the current Topic—and its
protection—continues. This contract intentionally does not redesign Topic
resolution; callers that need a protection reset must supply authoritative
Topic identity.

Retries copy the original attempt decision, and idempotent replay returns the
original attempt without resolving protection again. Output-risk audits store
detector/rule metadata and candidate hashes, never candidate text, retrieved
private content, secrets, or prompts.
