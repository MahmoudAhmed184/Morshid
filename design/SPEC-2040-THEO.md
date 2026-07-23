# Morshid — Specification Part IV: "The Quiet Interface" (v5, Theo round)

**Author: Design Director (Fable). Status: BINDING — extends the SPEC-2040 family; where it conflicts with Parts I–III (including F1/F3), Part IV wins. Reference material: t3.chat screenshots in `screenshots/`. The mandate: keep the warm paper/ink THEME, adopt t3.chat's calm STRUCTURE — uncluttered surfaces, one consistent sidebar, stock modern components downloaded from the shadcn registry and themed by tokens, never hand-generated.**

**Data constraint unchanged: existing hooks/queries only. No new API calls, no new react-query keys. Client-side derivations (filtering loaded lists, grouping by date) are allowed.**

---

## T1. Token repivot — ink primary, demoted blue (REPLACES F1's color law)

The root cause of every "still blue" report: `--primary` is ink-BLUE, so every stock component default (Badge fill, Button hover, tint chips `bg-primary/10 text-primary`) leaks blue. t3.chat has exactly one brand fill; ours is **ink**.

- `--primary` → warm ink: light `oklch(0.24 0.02 60)` with `--primary-foreground: oklch(0.97 0.008 85)`; dark `oklch(0.93 0.01 85)` with `--primary-foreground: oklch(0.22 0.015 60)`. (Match the existing foreground/background family exactly if these differ from styles.css current foreground values — primary must equal the theme's ink, verify against the file.)
- Blue lives on as the RESERVED accent, already tokenized as `--info` (keep current blue oklch values; verify `--info` renders identically to the old `--primary` blue; if `--info` differs, set it to the old `--primary` blue values).
- `--ring` stays the blue focus ring (explicit blue value, no longer derived from primary). Focus visibility is blue's one ambient job.
- ALLOWED blue after this round: text links (`.link-editorial`), citation chips/evidence borders (`student-citation-sources.tsx`, `student-sources-panel.tsx` — migrate their `primary` classes to `info`), landing/auth editorial accents (migrate `text-primary`/`bg-primary` in `features/landing/**` and auth pages to `info` equivalents so they keep TODAY'S visual blue), focus rings. NOTHING else. The MORSHID chat avatar chip and speaker labels become ink automatically via the repivot — that is the intended outcome.
- `::selection` stays gold. Warm `--accent`/`--secondary`/sidebar families unchanged.
- Consequence sweep: `bg-primary/10 text-primary` tint chips everywhere become warm ink tints automatically — correct, keep. Delete the StatCard `primary` tone entirely (see T6); `admin-status-badge` `default` dot → `bg-muted-foreground`.

## T2. Component rebase — download, don't generate

- From `client/`: first `npx shadcn@latest add --dry-run` then run for real:
  `npx shadcn@latest add --overwrite --yes accordion alert alert-dialog aspect-ratio avatar badge breadcrumb button card checkbox collapsible combobox command context-menu dialog dropdown-menu form input input-group input-otp label pagination select separator sheet sidebar skeleton sonner switch table tabs textarea tooltip use-mobile`
  (33 components + the `use-mobile` hook; all verified to exist under the base-nova style; zero new npm deps needed.)
- NEVER overwritten by the CLI, preserve as-is: `ui/mode-toggle.tsx`, everything in `ui/custom/`. After overwriting `sonner.tsx`, re-apply its local theme-provider wiring (it must keep using `@/providers/theme-provider`, not `next-themes`).
- Fix `components.json`: remove the stale `"config": "tailwind.config.js"` entry (Tailwind v4 CSS-first project).
- **Delta ledger** — the ONLY post-download edits allowed inside `ui/*.tsx`, each marked with a `/* morshid: */` comment:
  1. `badge.tsx`: add our `success`, `warning`, `gold` variants (warm washes per existing idiom) and the mono-uppercase sizing idiom IF the stock base classes lost it (compare first — prefer stock).
  2. `button.tsx`: keep stock variants. If stock default hover derives from primary it is now ink — correct, no edit. Remove nothing else; `AsyncButton` in `custom/` adapts to the fresh Button API if it changed.
  3. `sonner.tsx`: theme-provider rewiring (above).
  4. NOTHING else. If a consumer breaks against a fresh component, fix the CONSUMER, not the primitive. Every consumer fix gets reported.
- Kill the metastasized copies: the four hand-rolled card divs (`admin-panel.tsx`, `dashboard-course-section.tsx:30`, `student-courses-page.tsx:41`, plus user-card divs) become real `<Card>` compositions in their next-touching phase (T5/T6); `border-foreground/8` must not survive anywhere.
- Verify after rebase: typecheck, lint, full client tests, and grep bars: no `border-foreground/8`, no `rounded-[` in feature code, no `hover:bg-primary` producing blue (it's ink now), no `text-primary` outside allowed files.

## T3. One sidebar, three roles (REPLACES D1 sidebar + the student rail)

One component: `components/layout/app-sidebar.tsx` built on the fresh `ui/sidebar.tsx` primitives (`SidebarProvider` + `Sidebar variant="sidebar" collapsible="offcanvas"` — flat, edge-to-edge, calm; NOT inset/floating panels). Used by ALL three role shells. Delete `studio-sidebar.tsx` and the student rail in `student-session-navigation.tsx` (its list/query logic moves into the sidebar's student section; preserve the existing session-list behavioral contracts and test semantics).

Anatomy (top → bottom):
1. **Header**: `SidebarTrigger` (PanelLeft icon) + wordmark `Morshid` (Fraunces, 1.125rem). Wordmark links: student → `/courses`, instructor → `/instructor`, admin → `/admin`. NO role chip.
2. **Primary action** (student only): full-width `New chat` Button default (ink fill, `rounded-lg`), `Plus` icon.
3. **Search** (student only): borderless input, `Search` icon left, placeholder `Search your chats...`, hairline `.rule` below (t3 idiom, not a boxed field). Client-side filter of the already-loaded session list. No new queries.
4. **Content**:
   - Student: session list grouped by relative time — `.smallcaps-label` group headings `Today` / `Yesterday` / `Last 7 days` / `Older` (derive from existing `updatedAt`/`createdAt` on loaded sessions). Rows are PLAIN TEXT titles only — no leading icons, no "No messages yet" subtitle, single line truncated. Hover: warm accent + kebab actions appear (existing rename/delete menu logic preserved). Active: warm accent + left rubric bar. Infinite scroll/skeleton behavior preserved.
   - Instructor: `SidebarMenu` — Dashboard, Review Queue, Materials, Settings (existing routes; icons per F2, `size-4`).
   - Admin: Dashboard, Assignments, Users, Courses, Materials, Audit Logs, Settings.
5. **Footer**: user row — Avatar (initials, `bg-secondary text-foreground`) + name + email `.footnote` (NO role label for any role) — clicking opens a `DropdownMenu`: `Settings`, theme submenu (Light/Dark/System via existing theme provider), separator, `Sign out`. This replaces the old user cards AND the separate mode-toggle placement in app shells (landing/auth keep their own mode toggle).
6. **Collapsed state** (offcanvas): a fixed top-left floating cluster `glass-paper rounded-xl shadow-sm p-1 flex gap-1`: `SidebarTrigger` + (student only) `Search` icon-button (focuses sidebar search after expanding) + `Plus` icon-button (new chat). Staff cluster is the trigger alone. Content top bar must not jump (pad-left when cluster present).
7. Mobile: existing Sheet behavior from the sidebar primitive; keyboard shortcut (Cmd/Ctrl+B) stays.

Course switcher: REMOVED from the sidebar (it moves into the composer, T5). "All courses →" link: REMOVED (home IS the courses page; wordmark links there).

## T4. Student routes — root-level, courses first (REPLACES F3 routing)

- `authRedirectByRole.STUDENT` → `'/courses'` (auth-redirect.ts; type name updates as needed). Login as student lands on **the courses page**.
- New pathless layout `routes/_student.tsx`: `requireRole('STUDENT')` guard + courses `ensureQueryData` loader + shell (SidebarProvider + AppSidebar + content). Children:
  - `routes/_student.courses.tsx` → URL `/courses` — the library (T5a).
  - `routes/_student.chat.tsx` → URL `/chat` — the workspace; keeps the current search-param schema (`courseId`, `sessionId`).
  - `routes/_student.settings.tsx` → URL `/settings`.
- Legacy redirects: `/student` → `/courses`; `/student/ai-tutor` → `/chat` (preserving search params); `/student/courses` → `/courses`; `/student/settings` → `/settings`. Thin `beforeLoad: redirect` routes.
- Delete the old `routes/student/` tree; regenerate `routeTree.gen.ts` (`tsr generate`). Migrate route tests deliberately.
- Guest landing at `/` unchanged.

## T5. Student surfaces — the quiet notebook

**a) `/courses` — the Library (rework of the Shelf).** This is the student's home. PageHeader replaced by a t3-calm opening: time-aware greeting as the title (`Good evening, Sara.` — existing greeting logic, Fraunces `.display-2`), NO eyebrow, description `Choose a course to continue.` Then course cards, grid `md:grid-cols-2 xl:grid-cols-3 gap-4`: real `<Card>` `rounded-2xl hover-float p-6` — course title `text-lg font-medium` and a `.footnote` `Open →` affordance line. NO course code, NO code-derived initials tile (if a tile is kept, derive initials from the TITLE), NO "Assigned" badge, NO rule clutter. Clicking anywhere on the card → `/chat?courseId=…` (existing selection mechanism).

**b) `/chat` — the workspace.**
- **Top bar** (slim, borderless or hairline-rule): left = current session title (plain text, truncated) or nothing when no session; right = sources-panel toggle (`BookMarked` icon-button). NO `STUDENT · <CODE>` breadcrumb, NO mode toggle here (it lives in the sidebar footer). Sidebar trigger appears only via the collapsed floating cluster.
- **DELETE the duplicate conversation header** (`student-conversation-header.tsx` — course chip + title + h1). The session title lives in the top bar; course identity lives in the composer picker.
- **Empty/new-chat state** (t3 verbatim-adapted, centered in the reading column): title `How can I help you, {firstName}?` (Fraunces `.display-2`; fallback without name: `How can I help you?`). Below: suggestion list — REPLACE the three glass pills with plain text rows, hairline-separated (`.rule` between rows), `text-sm text-muted-foreground hover:text-foreground cursor-pointer`, left-aligned in the column: `Why does quicksort average O(n log n)?` / `Walk me through problem set 3.` / `What did lecture 8 actually claim?` Clicking a row prefills the composer draft (client-side only) and focuses it. No icon chips, no cards.
- **Composer** (the control surface, t3 model): `glass-paper rounded-2xl shadow-md` wrapper containing (1) borderless textarea row, (2) a bottom controls row: LEFT = **course picker** — ghost sm button `{course title} <ChevronDown className="size-3.5">` opening a `DropdownMenu` listing course TITLES (check on the active one), separator, `All courses` item → `/courses`. RIGHT = send icon-button (`size-9 rounded-full bg-primary` — now ink). ALL existing composer behavior byte-identical (draft limit, clientMessageId, Enter-to-send, disabled logic, aria wiring, hint + error copy). The old sidebar course-switcher component is deleted; its aria/test contracts migrate to the picker (`aria-label` uses course TITLE only).
- **Messages**: unchanged from F8/F9 except automatic recolors from T1 (tutor avatar chip → ink tint; citation chips migrate `primary`→`info` blue per T1).
- **Sources panel**: keep behavior; ABOUT THIS NOTEBOOK drops the mono code line; keep title, Assigned-course success badge, privacy note.
- **Course-code purge (student surfaces, total)**: all nine audit sites — shelf card + initials, switcher trigger/menu/aria, conversation-header chip (deleted anyway), top-bar breadcrumb, `courseCode` prop plumbing in `student-ai-tutor-page.tsx`, sources panel. Grep bar: no `course.code` / `courseCode` reference renders in any student-facing component (schema fields may remain).

**c) `/settings`** — unchanged content; opens from sidebar footer menu.

## T6. Staff surfaces — same shell, fresh cards

- Both staff shells adopt `AppSidebar` + `SidebarProvider` (delete role-specific sidebar/layout chrome: `studio-sidebar.tsx`, admin/instructor layout sidebars). Top bars keep their breadcrumbs (staff MAY see course codes — the purge is student-only).
- Card sanitation on the fresh primitive: `review-queue-page.tsx` and `materials-page.tsx` drop the `py-0`-reset pattern and compose stock `Card/CardHeader/CardContent` slots; `dashboard-course-section.tsx` and `admin-panel.tsx` hand-rolled divs become real `<Card>`; `pdf-card.tsx` removes the `p-5`-on-Card conflict and its unknown-status chip tone becomes `muted`.
- `stat-card.tsx` (custom): DELETE the `primary` tone (consumers move to warm tones: admin Students stat → `gold`, quickNav Users chip → neutral ink tint, recent-activity chip → neutral); trend text → `text-muted-foreground`.
- `admin-status-badge.tsx` `default` dot → `bg-muted-foreground`.
- Development status page icons: `text-primary` is now ink — leave as-is.

## T8. Landing/auth regression remediation (BINDING — corrects T1 overreach)

User-reported regressions after the repivot/rebase. Ground truth for "previous look" = commit `137364c` (pre-v5). Blue's reserved set SHRINKS again: **citations and focus rings only**. Links are NOT blue.

- **T8.1 Links are ink.** `.link-editorial` reverts to `color: inherit` (keep its underline/offset idiom exactly as it was at `137364c`). Footer columns (Product/Company/Legal), `Read the method ↓`, `Forgot password?`, `Open the queue →` and every other editorial link render ink with the underline treatment, both themes. Citation chips/evidence borders KEEP their `info` blue.
- **T8.2 Landing/navbar/auth button presentation restored.** The fresh stock Button shrank the landing CTAs and navbar button and lost the editorial typography. Recover the exact pre-v5 rendered classes: diff each call site (navbar, hero CTA, colophon CTA, auth submit, any landing section buttons) between `137364c` and HEAD, including what the OLD `button.tsx` variants contributed (`git show 137364c:client/src/components/ui/button.tsx`), and restore the previous visual size/shape/typography (pill radius, height, padding, font size/tracking) — preferably via call-site classes; a `/* morshid: */` delta in `button.tsx` is allowed ONLY if the old presentation lived in a variant that multiple call sites share (report which route was taken). App-surface buttons (student/staff) are NOT in scope — they stay stock.
- **T8.3 Colophon CTA ("Bring the course. Keep the understanding.")**: its button must never turn blue on hover/active/selected. On the inverted ink band the hover is the warm inverse (paper `bg-background text-foreground` fill, per the pre-v5 inverted idiom if it was warm; if the pre-v5 hover was blue, override it — warm inverse wins). Same rule for any other button on inverted bands.
- **T8.4 Link/button typography on landing/auth**: wherever the rebase changed font-size/tracking/weight of links or buttons on these surfaces, restore the `137364c` values (call-site or utility-level, reported).
- **T8.5 Verification**: side-by-side screenshots (landing top/method/colophon/footer, sign-in; both themes) against `137364c` equivalents; zero blue links anywhere; buttons visually match pre-v5 proportions; citations still blue; app surfaces unchanged (spot-check /courses and one staff page for accidental fallout).

## T9. Chrome removal + the t3 corner treatment (BINDING)

Reference: `screenshots/Screenshot_20260723_182214.png` (sidebar open — note the sidebar-colored band above the content panel and the top-right controls sitting integrated in that band, with the content panel's rounded top corner) vs `Screenshot_20260723_182236.png` (collapsed — controls float free).

- **T9.1 Breadcrumb bars die.** Remove the top breadcrumb bars from ALL dashboards: the staff `DashboardHeader` ("ADMIN · SETTINGS" / "INSTRUCTOR · DASHBOARD" style) is deleted from both staff shells (its `{actions}` slot consumers, if any, move into their page content next to the PageHeader; report each). The student top bar (session title + sources toggle) is deleted too — the session title lives in the sidebar's active item; the sources toggle moves to the new top-right cluster (T9.2). Page titles remain the in-content PageHeaders. The staff collapsed-state floating trigger cluster stays; the expanded-state trigger lives in the sidebar header (already does).
- **T9.2 Student top-right cluster (t3 model).** A control cluster containing exactly two icon-buttons: sources-panel toggle (`BookMarked`) and theme switcher (sun/moon toggle cycling or the existing mode-toggle menu). Two states:
  - **Sidebar expanded (desktop `md:`+)**: the app shell renders a `bg-sidebar` backdrop with the content as an inset panel — content panel gets `rounded-tl-2xl` where it meets the sidebar and a `bg-sidebar` top band; the top-right cluster sits INSIDE that band (integrated, `bg-sidebar`, no border/shadow), flush to the top-right, with the content panel's `rounded-tr-2xl` corner beneath/beside it forming the t3 notch. Implementation latitude: achieve the visual (sidebar-colored frame around a rounded content panel, controls living in the frame's top-right) with the plainest DOM (e.g., `SidebarInset` wrapper `bg-sidebar` + inner `rounded-t-2xl bg-background` panel + absolutely-positioned cluster in the frame). Report the DOM chosen.
  - **Sidebar collapsed**: the band disappears (content full-bleed) and the cluster becomes a floating `glass-paper rounded-xl shadow-sm p-1` cluster fixed top-right — the mirror of the top-left one.
  - Student-only. Applies to the whole student shell (all three routes) so the frame doesn't pop in/out between pages. The sidebar-footer theme submenu stays (two entry points are fine).
- **T9.3 Sources panel animation.** The citations/sources panel animates in/out smoothly: width+opacity (or transform) transition ≈ 250ms `ease-out` on toggle, the conversation column reflow animating with it (`transition-[width,margin]` on the affected containers). Honor `prefers-reduced-motion: reduce` (no animation). Mobile Sheet keeps its existing slide.
- **T9.4 Verification**: screenshots expanded + collapsed (both themes): band + integrated cluster when open, floating cluster when collapsed, no breadcrumb bars anywhere (student + both staff roles), sources panel animates (capture mid-transition or verify the transition classes + a before/after pair), no layout jump of the reading column beyond the panel width.

## T10. Stunning menus — the popover surface kit (BINDING)

Every floating menu in the app currently renders as a bare rectangle. Menus adopt the manuscript's glass materiality and a calm origin animation. ONE treatment, defined once, applied inside the primitives (this is a sanctioned delta-ledger extension — mark every edit `/* morshid: menu kit */`). No consumer file changes.

- **T10.1 Surface** (`DropdownMenuContent`, `ContextMenuContent`, `SelectContent`/`SelectPopup`, combobox popup, `CommandDialog`'s command surface, and the select-like popups inside command):
  `rounded-2xl border border-border/60 bg-popover/92 backdrop-blur-xl backdrop-saturate-150 p-1.5 shadow-[0_16px_40px_-12px] shadow-foreground/14 min-w-[12rem]` (keep each primitive's positioning/side-offset props; side offset ≥ 6px). Dark mode: same classes (tokens handle it) — verify the popover token has enough contrast against content; if not, adjust `--popover` slightly (report values).
- **T10.2 Items** (menu items, select items, command items, radio/checkbox items):
  `rounded-lg px-3 py-2 gap-2.5 text-sm` — highlight state = warm accent (`data-highlighted`/focus → `bg-accent text-accent-foreground`); icons `size-4 text-muted-foreground` inheriting foreground when highlighted; destructive items `text-destructive` with `data-highlighted:bg-destructive/10`; selected check `size-4` right-aligned for selects/radio (keep each primitive's existing indicator slot position if moving it breaks the API — report); disabled `opacity-50`.
  Labels/group headings: `.smallcaps-label px-3 pt-2 pb-1`. Separators: hairline `bg-border/70 -mx-1 my-1`.
- **T10.3 Motion**: origin-aware entrance ≈ 150ms ease-out — `opacity 0→1, scale 0.96→1, translateY 4px→0` from the trigger side (base-ui data-side attributes drive `transform-origin`); exit ≈ 100ms. Implement as styles.css utilities (e.g. `.menu-pop` keyframes + `data-[open]`/`data-[starting-style]` hooks per base-ui transition conventions) so all primitives share it. `prefers-reduced-motion: reduce` → opacity-only.
- **T10.4 Harmonize**: tooltip content `rounded-lg` ink surface (keep small/simple, no blur); Sheet/Dialog NOT in scope (already treated).
- **T10.5 Verification**: screenshots open-state in both themes of: composer course picker, session kebab menu, sidebar footer account menu, an admin table select/filter, the admin row-actions (if menu), command palette (if reachable). Bars: identical surface/item treatment across all; animation classes present; reduced-motion path exists; no clipped shadows (check overflow on portals); tests green.

## T11. Sidebar fit-and-finish (BINDING)

- **T11.1 Search input inset.** In the sidebar chat search, the typed text/caret starts too close to the leading icon (ugly in dark mode). The input takes a proper left inset clearing the icon (icon `size-4` at `left-3` → input `pl-9`; match the file's actual geometry), placeholder and typed text aligned identically; caret never under the icon. Verify visually in dark.
- **T11.2 New-chat guard (no more empty-session spam).** Clicking `New chat` must NOT create another session when an empty one is already at hand:
  1. If the CURRENTLY-SELECTED session has no messages → do not create; stay on it (navigate if needed) and focus the composer.
  2. Else, INVESTIGATE what the already-loaded session-list data exposes about emptiness (the old rail rendered "No messages yet" — find its source field: lastMessage/messageCount/timestamps). If derivable, reuse the newest empty session of the active course (navigate to it) instead of creating.
  3. Only when neither applies → create (existing mutation, unchanged).
  No new API calls/queries. Report which layers shipped and the emptiness signal used. Add tests for the guard (create-called vs not-called per case). The plus-button in the collapsed cluster follows the same guard.

## T12. Course isolation — the notebook switcher (BINDING; supersedes T4's `/courses` home and T5's composer picker)

Ruling: course = notebook (grounding context), NOT a chat filter. The switcher moves to the sidebar; the full-page picker and the composer picker retire.

- **T12.1 Sidebar course dropdown** (student, between the wordmark header and `New chat`): full-width quiet control — current course TITLE + `ChevronDown size-3.5`, `rounded-lg px-3 h-10 text-sm font-medium hover:bg-accent` — opening a T10-kit `DropdownMenu`: one item per course title, check on the active one. Selecting navigates `/chat?courseId=…` (existing selection mechanism) and the session list beneath re-scopes. Zero courses → static muted label `No courses yet`, no menu. One course → still a dropdown (single checked item). The switcher's aria-label uses titles only.
- **T12.2 Home = `/chat`.** `authRedirectByRole.STUDENT` → `'/chat'`. `/chat` without `courseId` resolves via the existing course-selection logic (last-used/first). `/courses` route becomes a redirect → `/chat`; DELETE `student-courses-page.tsx` (+ its test, coverage of the greeting moves to the chat empty-state tests if not already there). Legacy `/student*` redirects retarget the `/chat` family. Wordmark click (student) → `/chat`.
- **T12.3 Composer simplifies**: remove the course-picker row entirely — composer = textarea + send (+ hint/error), byte-identical behavior. Course identity lives in the sidebar dropdown + sources panel.
- **T12.4 New-chat guard** (T11.2) retargets: "no active course" case → no-op with the `No courses yet` state (never navigate to a deleted page).
- **T12.5 Verification**: login → `/chat` one hop; switcher swaps sessions+context; `/courses` redirects; composer has no picker; all prior chat/session contracts green.
- **T12.6 Collapsed-state collision fix (user-reported bug)**: with the sidebar COLLAPSED and the sources panel open, the panel's top edge reaches/underlaps the floating top-right cluster. When the sidebar is collapsed, the workspace content (specifically the sources-panel column, and anything else that would collide) must clear the floating clusters — plainest: the content panel keeps a `h-12`-equivalent top inset in the collapsed state too (or the sources wrapper gets `mt-12` when `state === 'collapsed'`), so the panel never sits under the cluster. Both themes, verify at `lg:` with the panel open + sidebar collapsed.

## T13. Dead-code cleanup round (BINDING)

Five redesign rounds left strata. Sweep `client/src` for dead/stale code and DELETE it:
- Orphaned components/pages (no import path from any route): check especially `features/student/**` leftovers (old shell/top-bar/pills/workspace-state remnants), `components/layout/**`, `components/ui/custom/**` (cube-loader, data-toolbar, empty/error/loading-state, page-header, search-input, stat-card tones — verify each has a live importer; delete unused).
- Unused exports within kept files (helpers, variants, types) — remove; unused npm deps ONLY flagged, not removed.
- styles.css utilities with zero class usage in src (candidates: `.sheet-stack`, `.atmosphere`, `.display-index`, `.shimmer`, `.rubric-square`, others — grep each) — delete the dead ones.
- Stale tests testing deleted things; stale mocks/fixtures.
- Method: prefer `npx knip` if it runs cleanly without config wrestling; otherwise import-graph via grep/tsc. EVERY deletion listed in the report with its evidence (zero importers). When in doubt (dynamic/registry usage, route files, test utils), KEEP and flag.
- Bars: typecheck, lint, full client+server tests, build, root `npm run check` — all green after deletions.

## T7. QA bars (v5)

1. Blue exists ONLY as: links, citation chips/borders, focus rings, landing/auth editorial accents. Screenshot proof: buttons at rest AND hover, badges, stat chips, avatars, nav states — zero blue, both themes.
2. Sidebar identical structure across the three roles (screenshot side-by-side); collapse → floating cluster works; Cmd/Ctrl+B works; mobile sheet works.
3. Student flow: login → `/courses`; open course → `/chat?courseId=…`; legacy `/student*` URLs redirect. NO course code anywhere in student DOM (grep the rendered HTML).
4. Composer: course picker opens with titles only + `All courses`; suggestion rows prefill the composer; send behavior unchanged.
5. Fresh-component fidelity: dialogs, selects, dropdowns, tables render with stock base-nova spacing (no cramped/doubled padding); cards show no double-padding or `/8` borders.
6. All existing behavioral test contracts pass; tests migrated deliberately where flow/copy changed.
