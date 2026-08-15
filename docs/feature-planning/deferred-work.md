# Deferred and rejected work

This file records scope decisions from the feature grill. Reconsider a deferred
item only when its stated condition is true. Rejected items need a new product
or security decision, not merely spare implementation time.

## Deferred

| Work | Why it is deferred | Reconsider when |
|---|---|---|
| Student mastery and progress dashboard | Current model analysis is not a validated mastery measure | Evaluation proves a stable, explainable measure and Student messaging is reviewed |
| Study reminders | Requires scheduling and a delivery channel | Browser or email delivery has an approved capability owner |
| Message bookmarks | Pinning and archive solve the immediate organization need | Students demonstrate a need for message-level retrieval |
| Cross-Conversation full-text search | Expands indexing and private-data handling | Search threat model, retention, and Course isolation tests are designed |
| Notification preferences | In-app badges currently carry required review and failure state | At least one optional delivery channel exists |
| Email and browser notifications | Adds external delivery, retries, consent, and addresses | A delivery provider and privacy policy are approved |
| Reusable Instructor review snippets | May encourage low-attention review | Review-quality testing shows a safe use case |
| Bulk review actions | Conflicts with deliberate case-by-case oversight | A bounded non-pedagogical action can be proven safe |
| Instructor announcements | Moves Morshid toward LMS behavior | Product scope explicitly adds Course communications |
| Allowed Material file types | PDF is the only supported ingestion type | Multi-format ingestion ships |
| Reviewed Guidance retrieval | Needs ranking, provenance, invalidation, and official-Material precedence | F21 is stable and a second-tier retrieval design is approved |
| Automatic retention cleanup | Destructive automation needs operational evidence | F23 manual operations have a successful audit history and retry runbook |
| Exact provider quota remaining or billing | Current providers do not expose one trustworthy cross-project value | An authoritative vendor interface is available |
| Tenant branding | There is no tenant domain | Multi-tenant isolation is approved |
| Feature rollout controls | No current staged-rollout requirement | A real feature needs controlled exposure |
| Lossless machine audit export | Spreadsheet safety and lossless interchange conflict | A separate JSON or SIEM contract is requested |
| Localized URLs and languages beyond English/Arabic | Adds routing and translation scope without pilot value | A target institution requires it |
| Profile photos and self-service email changes | Add storage, verification, and moderation work | Identity requirements justify the extra lifecycle |

## Rejected for this product baseline

| Work | Decision |
|---|---|
| Generic notification module | Keep Student review updates in Reviews and derive operational badges from owning capabilities |
| User impersonation | Security, consent, and audit risks outweigh support value |
| Per-Student permanent allowance overrides | Use audited one-day Allowance Resets; avoid opaque fairness exceptions |
| Unlimited allowance values | Keep explicit bounded limits so spending and workload remain predictable |
| Runtime editing of HTTP abuse limits | Show them read-only; deployment security configuration owns them |
| Weakenable password rules | Password controls may report fixed standards but cannot lower them |
| Instructor access to unflagged analytics or Conversations | Preserve the privacy boundary regardless of dashboard value |
| Automatic publication into Reviewed Guidance | Every entry requires an explicit Instructor action |

## Existing roadmap still deferred

The following pre-existing items remain governed by
[`docs/project-delivery-plan.md`](../project-delivery-plan.md): SSE chat streaming,
the automated golden-dataset runner, hybrid retrieval, multi-format ingestion,
cloud object storage, LTI 1.3, and institutional SAML/OIDC. This packet promotes
Arabic/RTL and Reviewed Guidance management only; it does not silently promote
the other roadmap items.

