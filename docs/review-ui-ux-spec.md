# Instructor Review Queue and Review Details — Current UI/UX Specification

## Scope and intent

This document records the current implementation of the Instructor Review Queue and Instructor Review Details experiences. It is descriptive, not a redesign proposal. Any future design must preserve the functional constraints in this document unless the product and API contracts are intentionally changed separately.

The pages are available only inside the authenticated Instructor workspace:

- Queue: `/instructor/review-queue/`
- Detail: `/instructor/review-queue/:reviewCaseId`

Both pages sit inside the Instructor workspace shell. On desktop, the shell has the persistent Instructor sidebar. On viewports below `md`, it instead exposes a sticky, 56 px-high top bar with the sidebar trigger and “Instructor Workspace.” The scrollable content area is centered at `max-w-7xl`, with horizontal padding of 16 px, 24 px at `sm`, and 32 px at `md`; vertical padding is 20 px and becomes 32 px at `sm`.

## Shared domain and visibility rules

- The server endpoints require an authenticated user with the `INSTRUCTOR` role.
- Queue results and workload data are limited to courses the current Instructor can manage. A requested unowned course is concealed as not found.
- A detail response is available only for an accessible assigned-course review. Missing, deleted, guessed, unowned, or otherwise inaccessible cases use the same unavailable presentation and do not reveal private data.
- The UI receives bounded review evidence only. It does not render student email, internal metadata, a full conversation, full source documents, or unrelated/private messages.
- Review statuses in the data contract are `PENDING`, `IN_REVIEW`, `RESOLVED`, and `REJECTED`.
- Trigger values are `STUDENT_REQUEST`, `GENERAL_NOT_FOUND`, `CITATION_MISSING`, `SOURCE_CONFLICT`, `POLICY_CHECK_FAILED`, and `FINAL_ANSWER_RISK`.
- Student flag reasons are `INCORRECT`, `CONFUSING`, `UNHELPFUL`, `COURSE_MISMATCH`, `TOO_MUCH_ANSWER`, and `OTHER`.

## Instructor Review Queue

### Overall page structure

The page is a vertical stack with 32 px gaps:

1. Page header.
2. Workload summary area.
3. One large queue card containing queue heading, controls, filters, and review rows.

The queue chrome remains rendered while queue data loads. The workload summary has its own independent query and state.

### UI element inventory

| UI element | Purpose and current content | Interaction | Essential | Collapsible | Visibility and approximate position |
| --- | --- | --- | --- | --- | --- |
| Page header | Establishes workspace context. Eyebrow: “Instructor workspace”; H1: “Review Queue”; description: “Review flagged responses from your assigned courses.” | None | Yes | No | Always visible at the top of the content column; bottom border and 24 px bottom padding. |
| Workload snapshot | Summarizes workload in four `StatCard`s: Pending, Resolved, Rejected, and Oldest Pending Case. | Pending, Resolved, and Rejected cards are keyboard- and pointer-activated status filters. Oldest is informational only. | Secondary to the actual queue, but currently prominent and always allocated above it | No | Directly below the page header. One column by default, two at `sm`, four at `xl`; 16 px gaps. |
| Queue container | Groups all list controls and results in a bordered `Card`. | None itself | Yes | No | Below summary. `overflow-hidden`; header and content are separated by a border. |
| Queue section heading | Repeats “Review Queue,” shows a pending-count badge, and the subtitle “Escalations from your assigned courses.” | None | Yes, especially pending count | No | Top-left of the queue card header. |
| Saved presets menu | Shows “Presets” and a count badge. Can save the current criteria, apply saved criteria, rename a preset, or delete one after confirmation. Preset summaries can include status, course code, trigger, student reason, and quoted search. Maximum count is enforced by workspace preference storage. | Opens a dropdown and save/rename/delete dialogs. Presets are stored per authenticated user in local workspace preferences on this device. | Secondary convenience | Menu is transient/collapsible | Queue header, beside clear/search controls. Full width stack on narrow layouts; compact pill button at larger widths. |
| Clear filters | Restores search to empty, status to `PENDING`, and course/trigger/student reason to All/null. | Button click | Secondary but important when any filter differs from defaults | No | Appears only while filters are active, between presets and search. |
| Search | Searches loaded items by student display name, course title, course code, or the human-readable text of any trigger. Search is trimmed and case-insensitive. It does **not** search review ID, student note, student flag reason, status, or message content. | Updates results immediately on typing; no submit button or debounce | Yes for scanning a large loaded queue | No | Right side of the queue header on large screens; full width on mobile, 288 px at `sm`, 320 px at `lg`; search icon inside the input. Placeholder: “Search students or courses…”. |
| Status tabs | Filters by status and shows counts based on all currently loaded items: All, Pending, Resolved, Rejected. The active tab has primary text and a 2 px underline. | Click/tap; implemented as accessible tabs | Yes | No | Full-width horizontal row below heading/search. Horizontally scrollable, with non-wrapping tabs. |
| Course filter | Options are “All courses” plus each distinct course found in the fetched queue. Options show `code · title`; selected trigger displays the course code. | Shadcn `Select` | Yes | Dropdown only | First of three filter selects; one column on mobile, three equal columns from `sm`. |
| Trigger filter | Options: All triggers, Student request, General not found, Citation missing, Source conflict, Policy check failed, Final answer risk. A case matches if any value in its `triggers` array equals the selection. | Shadcn `Select` | Yes | Dropdown only | Second filter select. |
| Student reason filter | Options: All Student reasons, Seems incorrect, Confusing or unclear, Not helpful, Doesn’t match course material, Gave away too much, Other. | Shadcn `Select`; changing it starts a differently keyed server query | Yes for student-request triage | Dropdown only | Third filter select. Current label retains the capitalized wording “Student.” |
| Review result list | Presents matching cases as vertically stacked card-like `<article>` rows with 12 px gaps. | Rows themselves are not clickable | Yes | No | Queue card content, padded 16 px and 20 px from `sm`. |
| Review row avatar | Circular initials derived from the first two non-empty parts of the student display name. | None | Secondary | No | Far left, fixed 40 px circle. |
| Student and course identity | Student display name, then course code, course title, and shortened review ID. Display name is truncated on one line. | None | Student and course are essential; short ID is secondary | No | Upper-left of each row, beside the avatar. |
| Status indicator | Status badge with icon and semantic tone. `PENDING` is shown as “Awaiting Review” with warning styling; `IN_REVIEW` as “In review” with info styling; `RESOLVED` as success; `REJECTED` as destructive. | None | Yes | No | Upper-right on `sm+`; stacked below/after identity on smaller widths. |
| Review request label | Text “Review request” followed by the shortened review ID. | None | Secondary; it duplicates the short ID already shown above | No | Separate line below identity with 12 px top margin. |
| Trigger badges | One badge for every trigger in deterministic creation order. `STUDENT_REQUEST` uses the info variant; other triggers use secondary styling. | None | Yes | No | Lower metadata line. Wraps as needed. |
| Student flag category | Human-readable outlined badge when a student flag reason exists. It supplements rather than replaces the trigger badges. | None | Yes for student-request cases; absent for cases without a category | No | In the lower metadata line after triggers. |
| Student note preview | Prefix “Student note:” followed by the note, constrained to roughly 320 px and truncated to one line. | None | Secondary preview; full note is shown in details | No | In the lower metadata line; omitted when null. |
| Age | Clock icon and relative age derived from server-provided whole seconds, suffixed by “ago.” Units are seconds, minutes, hours/minutes, or days/hours. | None | Yes for prioritization | No | In the lower metadata line. |
| Open action | Outlined small button with “Open” and right arrow. Accessible name includes student and course. | Navigates to the detail URL and marks the navigation as a queue overlay | Yes; sole row action | No | Lower-right of each review row; wraps below metadata when space is limited. |

The short review ID is produced from the first segment before a hyphen, or the first eight characters when no segment is available.

### Filters and persistence

- Default state is `PENDING`, all courses, all triggers, all student reasons, and empty search.
- The visual status tab set omits `IN_REVIEW`, even though `IN_REVIEW` is a valid status and can be restored/applied through a saved preset or URL.
- Active filters are mirrored into the current URL using `history.replaceState`: `status`, `courseId`, `trigger`, `reason`, and `search`. Default `PENDING` and empty values are omitted.
- Initial loading accepts compatibility aliases `studentFlagReason` for `reason` and `q` for `search`; ongoing synchronization writes `reason` and `search`.
- Valid URL criteria take precedence on initial mount. Otherwise filter state is restored from per-user `sessionStorage` under `morshid:instructor-review-queue-filters:<userId>`.
- Preserved course options are retained when a student-reason query returns fewer/no courses, so controls remain usable.
- Course, status, trigger, and search filtering occur client-side after pages have loaded. Student flag reason is the only visible queue filter sent to the queue API by the current client.
- Selecting a course also scopes the independent workload-summary API query. It does not pass `courseId` to the current queue-list client request.

### Workload summary details

- **Pending:** server-provided count for the currently selected course (or all assigned courses); warning tone when nonzero, success when zero. Clicking selects `PENDING`.
- **Resolved:** count calculated from the fully loaded queue items after applying only the current course selection. Clicking selects `RESOLVED`.
- **Rejected:** calculated the same way as Resolved. Clicking selects `REJECTED`.
- **Oldest Pending Case:** server-provided relative age and a localized “Waiting since” date/time, or an em dash and “No backlog.” It is not interactive.
- The workload response also contains in-review, claimed-by-me, trigger breakdown, and flag-reason breakdown data, but the current UI intentionally does not render those metrics or breakdowns.
- If `totalActiveCount` is zero, a separate dashed card appears below the four metrics: “All clear — No review cases need attention,” with explanatory text. This can coexist with the queue’s own empty state and the four summary cards.
- Summary loading shows four card skeletons. Summary failure shows a destructive-tinted error card with the error message and Retry. No summary data means nothing is rendered.

### Pagination, ordering, and refresh behavior

- The queue endpoint is cursor-paginated and returns `items`, `pendingCount`, and nullable `nextCursor`.
- The client requests 100 items per page. The server supports limits from 1 to 100 and defaults to 25 for other consumers.
- There is no visible pagination, “Load more” button, infinite-scroll sentinel, page number, or partial-results indicator.
- While `nextCursor` exists, an effect immediately calls `fetchNextPage`. The page continues auto-fetching until no cursor remains.
- The entire list stays in the loading skeleton state while the initial query, any next page, or the presence of another next page indicates loading. Partially loaded rows are not shown.
- The server supplies deterministic pending-first ordering: status ascending, then creation time descending, then ID descending. Trigger arrays are in deterministic creation order.
- Queue data has a 30-second stale time and uses visibility-aware interval polling, including background refetch configuration.
- The pending badge uses the first fetched page’s server count. Status-tab counts and resolved/rejected workload counts are calculated from fetched items.

### Loading, empty, and error states

- **Loading:** queue header, controls, and filters remain present; the content area shows `InstructorListSkeleton` with accessible label “Loading review queue.” The same state remains through automatic cursor fetching.
- **Initial empty:** when there are no items and no student-reason filter, an icon state says “No review requests” and “New flagged responses from your assigned courses will appear here.”
- **Filtered empty:** when fetched items exist but no client filters match, or when a student-reason query returns no items, an icon state says “No matching reviews” and recommends changing search, status, course, trigger, or Student reason.
- **Error:** “Unable to load review queue” plus “The review queue could not be loaded. Try again.” A Retry action refetches; its state follows `isFetching`. The state has an approximate minimum height of 176 px.

### Responsive and spacing behavior

- The page uses an 8-unit/32 px gap between its three major sections, which creates a tall top-of-page stack before rows begin.
- Workload cards use 1/2/4 columns at base/`sm`/`xl`.
- Queue heading and controls stack vertically until `lg`. The control group is a column by default and a row from `sm`.
- Status tabs scroll horizontally instead of wrapping.
- The three dropdown filters stack until `sm`, then form three columns.
- Review row identity and status stack until `sm`; metadata and the Open action wrap according to available width.
- Review cards use 16 px padding, 20 px horizontal padding from `sm`, and a large 16 px corner radius.

### Current component and styling patterns

The page uses TanStack Router `Link`; TanStack Query infinite and standard queries; Lucide icons; Tailwind responsive/grid/flex utilities; and Shadcn-style `Card`, `Button`, `Input`, `Select`, `Badge`, `Skeleton`, and dropdown/dialog primitives. Shared custom UI includes `PageHeader`, `StatusBadge`, `StatCard`, `EmptyState`, `ErrorState`, `ConfirmDialog`, and `InstructorListSkeleton`.

## Instructor Review Details

### Entry modes and overall layout

The same detail component has two presentations:

- **Queue overlay:** Clicking a queue row’s Open action navigates to the detail URL with `reviewQueueOverlay: true`. The queue remains rendered behind a Shadcn `Dialog`. The dialog is vertically scrollable, is limited to viewport height minus 32 px, uses 20 px padding (28 px at `sm`), nearly fills the viewport width from `sm`, and caps at `max-w-7xl` at `xl`.
- **Standalone page:** Direct URL visits, reloads, or navigation without overlay state render a normal page within the Instructor shell. The detail content is centered and capped at `max-w-7xl`.

The content order is:

1. Header and status.
2. Compact metadata strip.
3. Optional student note.
4. Main review layout: evidence/content plus an action sidebar for active cases.
5. Small created/requested timestamp footer.

At `xl`, active cases use a two-column grid: flexible evidence column plus a fixed 24 rem action column. Below `xl`, everything is a single vertical column. Resolved/rejected cases omit the action column entirely.

### UI element inventory

| UI element | Purpose and current content | Interaction | Essential | Collapsible | Visibility and approximate position |
| --- | --- | --- | --- | --- | --- |
| Standalone back link | Returns to `/instructor/review-queue`. Uses a ghost small button style and Arrow Left. It is a plain anchor, causing normal navigation. | Click/tap | Yes in standalone presentation | No | Above the standalone page header; absent in dialog presentation. |
| Dialog close control | Standard Dialog close control supplied by `DialogContent`. Closing invokes browser/router history back. Browser Back also closes the overlay. | Click/tap or dialog dismissal/back navigation | Yes in overlay presentation | No | Dialog top-right. |
| Standalone header | Eyebrow: `<course code> · <student display name>`; title “Review detail”; description “Bounded context captured for this flagged response.” Status badge is the header action. | None | Yes | No | Top of standalone content inside an additional bottom-bordered wrapper. |
| Dialog header | Eyebrow: `<course code> · Instructor review`; title “Review flagged response”; description “The relevant exchange, evidence, and nearby context in one view.” Status badge aligns right at `sm+`. | None | Yes | No | Top of dialog content with extra right padding for close control. |
| Status badge | Humanized current status (`Pending`, `In review`, `Resolved`, or `Rejected`). | None | Yes | No | Header action/right side. |
| Compact metadata strip | Course title, student display name, all triggers joined by ` · `, localized requested date/time, and optional student flag category. Each item has an icon, uppercase micro-label, and truncated value with a native title tooltip. | Hover may expose browser title for truncated value | Yes | No | Immediately below header; bordered muted strip. One column at base, two at `sm`, intended five at `lg`. Border rules visually divide cells. |
| Student note | Full note with bold “Student note:” prefix. | None | Yes when present | No | A separate compact bordered/muted row below metadata; omitted when null. |
| Flagged exchange heading | Names and describes the primary evidence: “The question and original response submitted for review.” | None | Yes | No | Top of main evidence column. |
| Student message card | Full bounded flagged student message and its localized date/time. | Read-only | Yes; primary | No | Left card at `lg+`; above assistant card on smaller screens. |
| Original assistant response card | Full original assistant content and localized date/time. Slight primary-tinted border/background distinguishes it. | Read-only | Yes; primary and input to review actions | No | Right card at `lg+`; below student card on smaller screens. |
| Sources section | Header shows “Sources (N).” Expanded content shows each citation’s order, material title, and zero or more bounded snippets. Each snippet shows chunk number and excerpt; empty snippets say “No bounded snippet is available.” Material IDs are not shown. | Toggle open/closed | Secondary evidence | Yes, closed by default | Below the flagged exchange; omitted entirely when citations are empty. |
| Previous & Following section | Shows the immediately bounded previous and/or following exchange. Each available side may contain Student and/or Assistant message blocks. Message timestamps are not displayed here. | Toggle open/closed | Secondary context | Yes, closed by default | Below Sources when both exist; omitted if neither neighboring exchange exists. Expanded content becomes two columns at `lg`. |
| Review actions card | Private Instructor control area. Explains that the Instructor chooses exactly what is published and that original content stays read-only. | Contains terminal workflow controls | Yes for active cases | The entire card is not collapsible; an editor appears conditionally | Right sidebar at `xl`, sticky 24 px from top; below evidence at smaller widths. Omitted for terminal cases. |
| Approve original guidance | Publishes the unmodified original assistant response with outcome `APPROVED`. | Opens final confirmation dialog | Primary action | No | First full-width action button, green/success styling. |
| Publish edited guidance | Opens an editor prefilled with original assistant content. The editor supports up to 4,000 characters. | Edit, cancel, save local draft, then open final confirmation | Primary alternative | Editor is conditionally revealed/dismissed | Second full-width action, outlined info styling. |
| Reject request | Available only when `canReject` is true. Opens an empty rejection-reason editor limited to 500 characters. | Enter reason, cancel/save draft, then open destructive confirmation | Primary alternative for eligible cases | Editor is conditionally revealed/dismissed | Third full-width destructive action. Automatic/non-eligible cases do not show it. |
| Draft editor | Label is “Edited guidance” or “Rejection reason”; shows “Local draft · Version N.” Edited mode uses 10 rows; reject uses 4. | Text entry, Cancel, Save draft, Publish guidance/Confirm rejection | Essential once that mode is chosen | Yes in the sense that Cancel hides it | Inside the action card below the action buttons. |
| Draft status | Says either “Draft saved in this browser for this tab.” or “Unsaved changes remain available until this page is refreshed.” | Informational | Secondary | No | Below editor actions in micro text. |
| Final confirmation dialog | Title: “Publish this terminal review outcome?” Shows the exact Student-facing result in a scrollable preview and warns the action is final. Confirm label is “Publish outcome” or “Reject request.” | Confirm or dismiss | Yes | Transient modal | Over the details UI after selecting a valid terminal action. |
| Footer timestamps | “Created <localized date/time> · Requested <localized date/time>.” Requested time duplicates the metadata strip. | None | Secondary/audit context | No | Bottom of the page in small muted text. |

The detail contract includes `actions` history and `reviewSummary`, but the current detail UI renders neither an action-history section nor a resolved-outcome summary card. It also provides no replacement-guidance action even though `REPLACED` remains part of the wider API outcome contract.

### Review workflow and validation

- Actions render only while status is `PENDING` or `IN_REVIEW`.
- Approve sends the current `expectedVersion`, outcome `APPROVED`, and null content.
- Edited guidance is trimmed, must be non-empty, and sends outcome `EDITED` plus the edited content.
- Rejection is possible only when the server-provided `canReject` is true. The detail contract describes this as an active case containing only Student manual-review triggers. Its trimmed reason must be non-empty.
- Replacement (`REPLACED`) is accepted by the API contract but has no current UI control.
- All terminal submissions require an explicit confirmation dialog.
- While a resolve or reject mutation is pending, all review action buttons are disabled. The editor submit label becomes “Publishing…”.
- Each submission uses a generated `Idempotency-Key` and the current version for concurrency protection. The same key is reused for a retry of the same action payload.
- A successful terminal action clears the local draft and invalidates the exact detail query, all queue variants, and all workload-summary variants. The refreshed terminal detail hides the actions card.
- Mutation failure also invalidates those queries so stale state can be reconciled.
- Safe user-facing errors exist for stale version, already completed/invalid transitions, invalid requests/content, and ineligible automatic-case rejection. Raw internal error detail is not shown.
- Edited and rejection drafts are separately retained while switching modes. “Save draft” stores both drafts in `sessionStorage` under `morshid:review-draft:<reviewCaseId>`, scoped to schema version and review version. A successful terminal action removes it.

### Loading, error, and empty states

- **Loading:** a status region labeled “Loading review detail” displays one full-width 96 px skeleton, four metadata skeletons in a responsive grid, and one full-width 256 px skeleton.
- **Error/unavailable:** `ErrorState` shows “Unable to load review” and “This review is unavailable or you no longer have access.” Retry refetches and shows retry state. This intentionally covers both access denial and absence.
- **Empty:** there is no separate valid-detail empty state because the required detail contract always includes the flagged and assistant messages. Optional student note, sources, neighboring context, and actions are omitted independently when unavailable/inapplicable.
- **Action errors:** appear as a destructive `Alert` titled “Review action failed” inside the action card. Empty editor input uses inline validation instead.

### Responsive and spacing behavior

- Main detail sections use 16 px vertical gaps, substantially tighter than the queue page’s 32 px major gaps.
- Metadata is stacked at base, two columns at `sm`, and up to five columns at `lg`; long values are single-line truncated.
- Flagged message cards stack until `lg`, then use two equal columns.
- The action card is below the evidence until `xl`; at `xl` it occupies a fixed 384 px column and becomes sticky.
- Previous and Following content stacks until `lg`, then uses two columns.
- Dialog mode is constrained to the viewport and scrolls internally. On small screens it uses the base dialog sizing; from `sm`, it expands to approximately viewport width minus 48 px.
- Action-editor footer buttons use a non-wrapping row. The final submit button flexes, while Cancel and Save draft retain their content width; this can become tight on narrow screens.

### Current component and styling patterns

The detail uses Shadcn-style `Dialog`, `Card`, `Button`, `Textarea`, `Label`, `Alert`, `Skeleton`, and confirmation-dialog primitives; custom `PageHeader`, `StatusBadge`, and `ErrorState`; Lucide icons; and Tailwind grid/flex, responsive breakpoint, muted surface, semantic color, border, sticky, truncation, and whitespace-preservation utilities. Message content uses `whitespace-pre-wrap` and 24 px line height. Source/context disclosure is a local button-driven collapsible pattern using `aria-expanded` and `aria-controls`, not an Accordion component.

## Functional constraints that must not change during redesign

### APIs and contracts

- Keep the existing endpoints and payload semantics:
  - `GET /api/v1/instructor/reviews/workload-summary?courseId=...`
  - `GET /api/v1/instructor/reviews?limit=100&cursor=...&studentFlagReason=...`
  - `GET /api/v1/instructor/reviews/:reviewCaseId`
  - `POST /api/v1/instructor/reviews/:reviewCaseId/resolve`
  - `POST /api/v1/instructor/reviews/:reviewCaseId/reject`
- Preserve runtime response validation and the bounded detail model: only the target exchange, original assistant response/citations, immediately previous/following exchanges, allowed metadata, history, and review summary are returned.
- Preserve `expectedVersion`, idempotency headers, response outcome/status/version data, field limits, and server validation.

### Workflow, permissions, and statuses

- Instructor-role authorization and assigned/manageable-course scoping must remain enforced server-side.
- Missing and unauthorized detail records must remain indistinguishable in the UI and must not leak private or unrelated data.
- Preserve statuses `PENDING`, `IN_REVIEW`, `RESOLVED`, and `REJECTED`, including active versus terminal behavior.
- Preserve the current available UI actions: approve original, publish edited guidance, and conditional reject. Do not expose rejection when `canReject` is false. Do not add a replacement UI merely because the API enum contains `REPLACED`.
- Terminal actions remain final, confirmed, version-checked, idempotent, and followed by query invalidation/refetch.
- Original assistant content remains read-only.

### Filtering and pagination

- Preserve the default `PENDING` view and the exact matching rules described above.
- Preserve all trigger and student-reason values and their independent semantics. Student flag category must not replace trigger information.
- Preserve URL synchronization, per-user session restoration, per-user saved presets, and clearing back to defaults.
- Preserve cursor pagination, stable ordering, 100-item client pages, and the current automatic fetch-to-completion behavior unless pagination itself is explicitly included in a separate functional change.
- Do not accidentally convert client filters into incomplete-page filters: status, course, trigger, and search currently operate after all cursor pages load; student reason currently produces a server-filtered query.

### Navigation and data fetching

- Queue Open actions must navigate to the canonical detail URL.
- Queue-originated navigation must continue to support the detail overlay with queue context behind it; close/back must return through history. Direct navigation must continue to work as a standalone page with a queue back link.
- Preserve independent queue and workload queries, 30-second stale times, visibility-aware polling, active-detail polling, terminal-detail polling stop, and background refetch configuration.
- Preserve queue/detail/workload invalidation on both successful and failed mutations.
- Preserve accessible loading, error, retry, empty, tab, dialog, and disclosure semantics.

## Information hierarchy in the current implementation

### Essential information

- Queue: case status, student, course, all triggers, optional student flag category, case age, and the Open action.
- Detail: current status; course/student/trigger/requested metadata; full student message; full original assistant response; optional full student note; action eligibility; and the terminal action controls for active cases.
- Workflow safety: exact content preview before publishing, expected version, idempotent submission, action errors, and permission concealment.

### Secondary information

- Queue: avatar initials, shortened review ID, student note preview, saved-filter controls, status-tab counts, summary metrics, and descriptive copy.
- Detail: sources and adjacent exchange context (collapsed by default), duplicate created/requested footer, icons, and explanatory action copy.
- Secondary does not mean removable without product review; it describes current visual/task priority.

## Design Problems / Current UX Issues

These issues are directly supported by the current rendering and behavior:

- **Excessive vertical space before queue results:** the page header, a one-to-four-row workload summary, optional all-clear card, and a large queue-card header all precede the first review. On mobile, four stacked statistic cards make this especially long.
- **Duplicated page identity:** “Review Queue” appears in both the page-level H1 and the queue-card heading, with two similar descriptions.
- **Duplicated empty messaging:** when there are zero active cases, the workload area can show an “All clear” card while the queue card separately shows “No review requests,” in addition to four zero-state metric cards.
- **Duplicated identifiers within each row:** the shortened review ID appears in the student/course metadata line and again in “Review request <ID>.”
- **Crowded control header:** Presets, conditional Clear filters, and a wide search field share the same header region above status tabs and three more filters. They stack into multiple rows at smaller widths.
- **Incomplete visible status navigation:** `IN_REVIEW` is a supported, rendered, filterable status but has no status tab. It is reachable only through All, restored state, URL, or a saved preset.
- **Potentially confusing metric semantics:** Pending comes from a server summary, while Resolved and Rejected are calculated from loaded queue items. The cards look equivalent even though their sources and scope differ; the server-provided In Review count is not displayed.
- **Long blocking queue load:** all cursor pages are fetched automatically while only a skeleton is shown. Large queues cannot be scanned incrementally, and there is no progress, page count, or Load More affordance.
- **Search placeholder understates behavior:** it says “Search students or courses…” even though trigger labels are searchable too. Conversely, visible student notes, flag categories, statuses, and IDs are not searchable.
- **Course filtering is split across data sources:** selecting a course scopes the workload API but filters the queue client-side. This is invisible to users and contributes to differing metric/list semantics.
- **Review rows have weak content differentiation:** every row includes avatar, two occurrences of the ID, a generic “Review request” line, multiple badges, optional note, age, status, and a separate Open button. With multiple triggers or long course/note text, the wrapping metadata line makes rapid scanning harder.
- **Status tabs and row metadata can require horizontal/vertical adaptation:** status tabs horizontally scroll on narrow screens, while row metadata and the action wrap to variable heights, reducing consistent scan rhythm.
- **Detail primary action ambiguity:** three full-width action buttons have strong semantic colors, but no single default action is designated beyond ordering. Reject is visually strong/destructive, and edited guidance is framed alongside direct approval.
- **Detail action location changes substantially by viewport:** the action card is sticky beside evidence only at `xl`; on smaller screens it appears after all primary evidence plus any Sources and Previous/Following disclosure headers, requiring more scrolling to act.
- **Narrow action-editor controls can crowd:** Cancel, Save draft, and the submit action are forced into one non-wrapping row.
- **Metadata can conceal important values:** course, student, combined triggers, requested time, and student flag category are all single-line truncated in compact cells; the trigger cell may contain several joined values.
- **Repeated date information:** Requested appears in the metadata strip and again in the footer. The footer also introduces Created with low prominence after the full workflow.
- **Resolved/rejected detail has no outcome summary:** the action panel disappears for terminal cases, while the available `reviewSummary` and action history are not rendered. The page shows status and original evidence but not the completed action, published edited content, reason, actor, or resolution time.
- **Collapsed evidence can be overlooked:** sources and adjacent context are closed by default and represented by compact disclosure rows. This reduces scrolling, but their evidentiary importance is easy to miss during review.
