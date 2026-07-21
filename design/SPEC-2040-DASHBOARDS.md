# Morshid — "Soft Manuscript 2040" Specification, Part II: Dashboards

**Author: Design Director (Fable). Status: BINDING — extends `SPEC-2040.md` and REPLACES its §6 (app surfaces are now a full layout redesign, not a re-materialization). SPEC-2040 §1–§3, §7–§9 and the EDITORIAL spec's copy/typography rules still bind. Zero creative liberties; spec-silent → plainest option consistent with this spec, reported.**

**Data constraint: use ONLY data already available from existing hooks/queries per page. No new API calls, no new react-query keys, no schema changes. If a specced element lacks data, degrade gracefully (omit or use the existing empty state) and report it.**

## D1. The Studio Shell (all three roles — one shell language)

- **Sidebar**: inset floating panel `m-3 rounded-2xl border bg-sidebar shadow-sm`, width `16rem` (tutor session rail is separate, see D4). Structure top→bottom:
  1. Wordmark row `px-4 pt-4`: ink logo mark 20px + "Morshid" Fraunces 1.125rem + role chip (Badge secondary, mono: `STUDENT` / `INSTRUCTOR` / `ADMIN`).
  2. Nav groups `px-3 pt-6`: group heading `.smallcaps-label px-2 pb-2`; items = `rounded-xl px-3 h-10 flex items-center gap-3 text-sm` with lucide icon size-4; active: `bg-sidebar-accent text-sidebar-accent-foreground` + absolute left 2px rubric bar `rounded-full h-5`; inactive hover `bg-secondary/60`. (ALL roles use sidebar-accent tokens — audit fix.)
  3. Spacer, then user card `m-3 rounded-xl border bg-card p-3`: avatar (initials, `bg-secondary text-foreground`), name text-sm medium, role `.footnote`; sign-out icon-button right (keep existing sign-out logic/menu).
- **Header**: sticky `top-3 z-40 mx-3 glass-paper rounded-2xl h-14 px-4 flex items-center justify-between shadow-sm`. Left: breadcrumb in `.smallcaps-label` ("STUDENT · DASHBOARD" style, current segment `text-foreground`). Right: mode-toggle + (existing header actions/user affordances, restyled). No page titles here — titles live in content.
- **Content**: `px-6 md:px-8 py-8`, `max-w-7xl mx-auto`. Every page opens with the canonical **PageHeader** (ui/custom/page-header: `.smallcaps-label` eyebrow, `.display-3` font-display title, muted description, action slot, bottom `.rule` pb-6). Migrate StudentPageHeader / admin-page-shell hand-rolled headers to it (audit fix); delete redundant local header components after migration.
- Mobile: sidebar becomes the existing sheet/drawer behavior restyled `rounded-r-3xl` (keep current open/close logic and test contracts).

## D2. Student dashboard — "The Desk" (student-dashboard-page.tsx)

PageHeader: eyebrow `YOUR DESK`; title = time-aware greeting with first name, e.g. `Good evening, Sara.` (keep existing greeting logic; period stays); description `Pick up where the last question left off.`; no action.
Then a bento grid `lg:grid-cols-3 gap-6`:
- **Resume panel** (col-span-2): `rounded-3xl bg-card border shadow-sm p-8 relative overflow-hidden` with `.atmosphere` backdrop inside and a left rubric accent bar (`absolute left-0 inset-y-8 w-0.5 bg-rubric rounded-full`). Content: eyebrow `.smallcaps-label` `CONTINUE`; most recent session title in `.display-3` (fallback: `Your first session awaits.`); metadata row `.footnote`: course name · mono course code · relative updated time (whatever exists in the sessions/courses data); CTA pill Button default `Open the tutor →` linking to the AI-tutor route. If session data isn't available on this page's existing queries, render the invite variant (`Ask your first question.` + same CTA) — report which variant shipped.
- **The Shelf** (col 3): Card `rounded-2xl p-6`: eyebrow `YOUR COURSES`; stacked rows (max 4): course tile (size-10 `rounded-lg bg-primary/10 text-primary` mono initials), name text-sm medium, code `.footnote`; row 5+ collapses into `.link-editorial` `All courses →` to the courses page. Empty: existing no-courses copy restyled.
- **Row 2** (3 cols): three StatCards (existing metrics: assigned-course count, tutor status, whatever exists today — keep current stat semantics/copy, `rounded-2xl`, tone chips per D6).

## D3. Student courses — "The Shelf" page (student-courses-page.tsx)

PageHeader: eyebrow `THE SHELF`, title `Your courses.`, description existing sentiment. Grid `md:grid-cols-2 xl:grid-cols-3 gap-6`; course card: Card `.hover-float rounded-2xl p-6`: top row = course tile (as D2) + Badge success `Assigned`; name `text-lg font-medium`; code mono `.footnote`; `.rule` ; footer link `.link-editorial` `Study with the tutor →` (existing route). Keep existing headings/roles where tests assert structure; update copy assertions as needed.

## D4. AI Tutor workspace — "The Session" (student-ai-tutor/**)

The flagship. Full-height workspace inside the shell content area (edge-to-edge, no max-w-7xl clamp — this page may use `p-0` content):
- **Session rail** (left, 18rem): matches sidebar materiality (`m-3 ml-0 rounded-2xl border bg-sidebar shadow-sm` — or continuous with shell per current DOM; keep existing structural test contracts: aside borders, list semantics, `scrollbar-themed`). Top: course-switcher as a soft-filled `rounded-xl` control; "New chat" uses AsyncButton **default variant** (ink pill — audit fix: remove the inline bg-primary override); session items `rounded-xl`, active = `bg-sidebar-accent` + rubric bar; footnote timestamps.
- **Conversation column**: reading measure `max-w-3xl mx-auto px-6`; conversation header slim: course chip + title + existing privacy cue, `.rule` below; messages per SPEC-2040 §6 (student `bg-accent rounded-2xl rounded-br-lg`; tutor `bg-card border shadow-xs rounded-2xl rounded-bl-lg`; tutor avatar = ink logo on `bg-primary/10 rounded-full`; system notes `.footnote` centered). Citation chips stay mono.
- **Composer**: pinned bottom within the column: `glass-paper rounded-2xl shadow-md p-2` wrapper, textarea soft-filled borderless inside, send icon-button pill; keep the disabled-state copy and behavior exactly (tests).
- **Empty/workspace states**: keep existing copy contracts; restyle `rounded-2xl`, generous, with three static suggestion pills (`glass-paper rounded-full px-4 py-2 .footnote`, non-interactive, aria-hidden decorative): `Why does quicksort average O(n log n)?` · `Walk me through problem set 3.` · `What did lecture 8 actually claim?`
- Skeletons mirror new layouts.

## D5. Instructor — "The Register"

- **Dashboard** (instructor-dashboard-page.tsx): PageHeader eyebrow `THE REGISTER`, title `Today's teaching desk.`, description existing sentiment. Then:
  1. Stat row: existing metrics as 3 StatCards (existing semantics; review-queue badge logic kept).
  2. Main row `lg:grid-cols-3 gap-6`: **Course panel** (col-2, `rounded-3xl p-8`, rubric left bar): existing course hero data (name display-3, code mono, materials/readiness info as it exists today, CTA pill to materials). **Review queue panel** (col-1, Card `rounded-2xl`): eyebrow `NEEDS REVIEW`, up-to-4 existing queue rows (`rounded-xl` each, warning badges), `.link-editorial` `Open the queue →`.
  3. **Source readiness**: full-width Card `rounded-2xl`, existing rows with semantic StatusBadges; keep skeleton aria-labels.
- **Materials** (materials-page.tsx + pdf-card): PageHeader with action = upload CTA (existing upload affordance, pill lg); pdf-card grid `md:grid-cols-2 xl:grid-cols-3`: Card `.hover-float rounded-2xl` with status-tinted left bar (`w-0.5 rounded-full bg-<tone>`), filename mono truncated, page count `.footnote`, StatusBadge; processing keeps spinner.
- **Review queue page**: rows as `rounded-xl` list inside one `rounded-2xl` Card; filters as pill controls.
- **My courses**: cards per D3 pattern (instructor variant of the same card anatomy).

## D6. Admin — "The Ledger"

- **Dashboard**: PageHeader eyebrow `THE LEDGER`, title `System overview.`; KPI strip = 4 StatCards; below, `lg:grid-cols-3`: recent-activity/audit feed (col-2, Card with row list, mono timestamps) + quick-nav panel (col-1: links to Users/Courses/Materials/Audit as `rounded-xl` rows with icons). Use only data the page already fetches; omit what doesn't exist (report).
- **Canonical table page pattern** (users/courses/assignments/materials/audit): PageHeader (+ primary action pill where it exists today); ONE Card `rounded-2xl overflow-hidden p-0`: toolbar row inside card top (`px-4 h-14 flex items-center gap-3 border-b`): existing search/filter controls soft-filled `rounded-xl`; table: header cells `.smallcaps-label h-11 bg-secondary/40`, rows `h-[52px] hover:bg-secondary/40`, mono for ids/codes/counts `tabular-nums`, StatusBadges semantic; scroll container `max-h-[65vh] overflow-auto scrollbar-themed` with `sticky top-0` header INSIDE the card (this resolves the v2 sticky-header conflict); pagination/footer row inside card bottom border-t. Disabled-user rows keep the destructive tint. All existing toolbar/dialog/query behavior preserved.
- **admin-audit-page**: remove the `color-mix` arbitrary text hack — plain `text-success` now passes with the fixed tokens (audit fix).
- Forms/dialogs inherit v3 primitives; reset-password/create-user dialogs get PageHeader-less `rounded-3xl` per §2.

## D7. Unifications (audit fixes — mandatory, app scope)

- ONE eyebrow/label implementation: `.smallcaps-label` everywhere (kill the three hand-rolled sans variants).
- ONE icon-chip pattern: `size-9 rounded-lg bg-<tone>/10 text-<tone>` (empty-state may use size-12; no rings, no /8 tints).
- Active-nav tokens: `sidebar-accent` family in ALL shells.
- Avatars: `bg-secondary text-foreground` (never muted-on-muted).
- Micro text sizes: only `text-xs` (0.75rem) or `.footnote` — kill `text-[0.68rem]`/`text-[0.7rem]`/`text-[0.8125rem]`.
- No `tracking-tight` stacked on `font-display`.
- Settings page (dashboard-settings-page.tsx): cards `rounded-2xl`, inputs inherit §2 soft-filled, keep API.

## D8. QA bars (additional)

- Shell must not double-scroll: one scroll container per page (tables may own an inner one).
- Sidebar + header + content alignment: consistent 12px outer gutter (`m-3`) all around; header and sidebar never overlap.
- Every dashboard page screenshotted in both themes before done (QA phase will do this via seeded/authed session if available; implementers verify via tests + reasoning).
- Tests: update assertions for changed copy/structure deliberately and minimally; behavioral/data assertions unchanged.
