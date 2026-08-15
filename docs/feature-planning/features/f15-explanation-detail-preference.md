# F15: Explanation detail preference

**Difficulty:** Moderate  
**Dependencies:** F01

## Outcome

Let a Student choose the usual level of explanation detail without changing
Morshid's teaching and safety policy.

## Contract

- Offer Concise, Standard, and Detailed; default to Standard.
- Store the preference in Tutoring, keyed by Student. Identity may expose the
  user ID but does not own this pedagogical preference.
- Resolve the value at the start of a Tutoring Attempt and persist the resolved
  value with that attempt so retries and later inspection are reproducible.
- Apply it only to response length, number of explanatory steps, and amount of
  contextual elaboration. It cannot change hint progression, effort checks,
  `NO_FINAL_ANSWER`, grounding, citations, Review Case creation, or guardrails.
- Existing messages never change. Deterministic fallbacks remain concise enough
  to be safe while acknowledging the selected preference where practical.

## Acceptance criteria

- [ ] The setting persists across devices and appears only to Students.
- [ ] Every generation path receives one validated resolved value.
- [ ] Prompt-contract tests prove the preference is subordinate to fixed
      teaching and response-governance rules.
- [ ] Invalid stored or requested values resolve to Standard.
- [ ] Replay uses the original attempt value even after the preference changes.
- [ ] Unit, E2E, and acceptance tests cover all values and policy invariants.

## Out of scope

Choosing hint level, disabling Socratic questions, changing academic-integrity
rules, per-Conversation preferences, and arbitrary prompt instructions.

