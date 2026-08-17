# Morshid feature implementation packet

**Status:** Approved planning baseline  
**Prepared:** 2026-08-15  
**Target:** production-shaped graduation release

This packet turns the feature grill into independently implementable vertical
slices. Implement one feature at a time with the prompt in
[`ANTIGRAVITY_PROMPT.md`](ANTIGRAVITY_PROMPT.md).

## Branch workflow

`feat/quality-of-life` is the integration branch and has a draft pull request to
`dev`. Implement only the features the operator selects. Each selected feature
starts from the latest integration branch, uses `feat/qol-fNN-<short-slug>`, and
returns through a pull request whose base is `feat/quality-of-life`. The prompt
contains the executable Git steps and merge gate.

## Read first

1. Repository [`AGENTS.md`](../../AGENTS.md)
2. Domain [`CONTEXT.md`](../../CONTEXT.md)
3. Client [`PRODUCT.md`](../../client/PRODUCT.md)
4. [`program-contract.md`](program-contract.md)
5. The selected feature brief and every dependency it names

## Feature catalog

| ID | Feature | Depends on |
|---|---|---|
| F01 | [Role-aware settings shell](features/f01-role-aware-settings-shell.md) | None |
| F02 | [Self-service profile](features/f02-self-service-profile.md) | F01 |
| F03 | [Appearance and accessibility](features/f03-appearance-and-accessibility.md) | F01 |
| F04 | [Self-service password change](features/f04-self-service-password-change.md) | F01 |
| F05 | [Active session management](features/f05-active-session-management.md) | F01 |
| F06 | [Arabic localization and RTL](features/f06-arabic-localization-and-rtl.md) | F01 |
| F07 | [Policy Day configuration](features/f07-policy-day-configuration.md) | F01 |
| F08 | [Tutoring Allowance](features/f08-tutoring-allowance.md) | F07 |
| F09 | [API abuse protection](features/f09-api-abuse-protection.md) | None |
| F10 | [Review Allowance](features/f10-review-allowance.md) | F07 |
| F11 | [Allowance Reset operations](features/f11-allowance-reset-operations.md) | F08, F10 |
| F12 | [Student draft autosave](features/f12-student-draft-autosave.md) | None |
| F13 | [Conversation pinning and archive](features/f13-conversation-pinning-and-archive.md) | None |
| F14 | [Conversation Markdown export](features/f14-conversation-markdown-export.md) | None |
| F15 | [Explanation detail preference](features/f15-explanation-detail-preference.md) | F01 |
| F16 | [Instructor workspace preferences](features/f16-instructor-workspace-preferences.md) | None |
| F17 | [Review workload summary](features/f17-review-workload-summary.md) | None |
| F18 | [Flagged misconception trends](features/f18-flagged-misconception-trends.md) | F17 |
| F19 | [Material failure alerts](features/f19-material-failure-alerts.md) | None |
| F20 | [Instructor effective-policy view](features/f20-instructor-effective-policy-view.md) | F08, F10 |
| F21 | [Reviewed Guidance Library](features/f21-reviewed-guidance-library.md) | None |
| F22 | [Material upload-size policy](features/f22-material-upload-size-policy.md) | F01 |
| F23 | [Course retention policy and cleanup](features/f23-course-retention-policy-and-cleanup.md) | F01 |
| F24 | [Identity security policy](features/f24-identity-security-policy.md) | F01, F04 |
| F25 | [AI capacity dashboard](features/f25-ai-capacity-dashboard.md) | F01 |
| F26 | [Contextual policy history](features/f26-contextual-policy-history.md) | F07, F08, F10, F22, F23, F24 |
| F27 | [Audit CSV export](features/f27-audit-csv-export.md) | None |

## Companion reports

- [`implementation-ease.md`](implementation-ease.md) ranks the features by
  expected implementation difficulty and gives a dependency-aware build order.
- [`deferred-work.md`](deferred-work.md) records postponed and rejected work.
- [`../research/feature-planning-primary-sources-2026-08-15.md`](../research/feature-planning-primary-sources-2026-08-15.md)
  captures implementation-changing findings from primary sources.
