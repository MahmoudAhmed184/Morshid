# Morshid — Specification Part III: Flows, Warmth & Simplification (v4)

**Author: Design Director (Fable). Status: BINDING — extends SPEC-2040.md + SPEC-2040-DASHBOARDS.md; where it conflicts with them, Part III wins. Grounded in docs/project-description.md §5 (Product Model): each course is a NOTEBOOK (shared course-scoped sources + private chat sessions + reviewed answers); the student UI is a ChatGPT-class sidebar chat with a collapsible NotebookLM-class citations/sources panel; "a separate Student dashboard is not required." Zero creative liberties; data constraint unchanged (existing hooks/queries only — degrade gracefully and report).**

## F1. Kill the blue wash (token rulings)

The `accent` family is currently a BLUE tint applied by every hover/selected state — that reads as noise in a warm paper world. Blue is henceforth RESERVED for: primary actions, links, focus rings, citation superscripts, MORSHID speaker labels. Everything ambient is warm.

```
light:  --accent: oklch(0.94 0.010 85);   --accent-foreground: oklch(0.24 0.02 60);   /* warm paper hover */
        --sidebar-accent: same as accent; --sidebar-accent-foreground: same as accent-foreground;
dark:   --accent: oklch(0.30 0.014 60);   --accent-foreground: oklch(0.93 0.01 85);
        --sidebar-accent: same;           --sidebar-accent-foreground: same;
::selection → the gold highlighter: light color-mix(gold 30%, transparent), dark color-mix(gold 25%, transparent), text color unchanged.
```
Sweep consequence: any component that relied on accent-foreground being blue for emphasis must switch to explicit `text-primary` ONLY if it is a link/citation/primary action; otherwise it stays foreground. Selected/hover rows, menu items, session items, nav items: warm accent + foreground text + (where specced) the rubric bar. Check base-ui menu/select/command highlight states inherit the new accent properly.

## F2. Icon discipline

- Nav/menu/list icons: lucide `size-4`, `strokeWidth={1.75}`, `text-muted-foreground`; active/selected item icon → `text-foreground`. Never `text-primary` on ambient icons.
- Icon chips (tone containers) keep tone colors per D7. Buttons: icon inherits button color.
- One icon per concept, fixed: sessions `MessageSquareText`, sources/materials `FileText`, courses/notebook `BookOpen`, review `ClipboardCheck`, users `Users`, audit `ScrollText`, settings `Settings2`, sign-out `LogOut`, upload `Upload`, citation `BookMarked`, flag `Flag`, notification `Bell`. Replace drifting variants (grep for near-duplicates like MessageCircle/MessagesSquare/FileStack/Book etc. and unify).
- No decorative icons in headings; PageHeader stays typographic.

## F3. Student = the Notebook (flow simplification)

Delete the student studio-shell chrome. The student experience IS the tutor workspace (ChatGPT model), with courses as notebooks (NotebookLM model).

- **Routes/flow**: `/student` → renders the workspace directly (no dashboard page). If the student has courses and a selected/last course → the workspace opens on it (existing selection logic). If no courses → full-screen empty state (existing copy). `/student/courses` remains as **The Shelf** (notebook picker, below) reachable from the rail; `/student/ai-tutor` keeps working (alias/redirect to the same workspace — keep whichever route the existing tests/links require, report the mapping). `/student/settings` stays, opened from the rail's user menu. DELETE `student-dashboard-page.tsx` (docs: no student dashboard) and its route content (redirect `/student` index to the workspace); migrate any test asserting the dashboard to the new flow.
- **One left rail** (the ChatGPT rail — replaces BOTH the studio sidebar and the old session rail), inset floating panel per D1 materiality, 19rem:
  1. Top: ink logo + "Morshid" wordmark row.
  2. Course switcher (existing component, soft-filled `rounded-xl`) + `.link-editorial` `All courses →` beneath it (to the Shelf).
  3. `New chat` AsyncButton default pill, full-width.
  4. `.smallcaps-label` `SESSIONS` + the session list (existing list semantics/tests preserved; items `rounded-xl`, active = warm accent + rubric bar).
  5. Bottom user card: avatar, name, role footnote; actions: settings link (icon) + sign-out (existing logic).
- **Top bar** (slim, glass, per D1): breadcrumb `STUDENT · <COURSE CODE>`; right: mode toggle (+ existing affordances). No duplicate headers below it.
- **Main column**: conversation per D4 (reading measure max-w-3xl, bubbles, glass composer, suggestion pills).
- **Right panel — SOURCES & CITATIONS (collapsible, NotebookLM)**: `lg:` visible 20rem inset panel, toggled by an icon-button (`BookMarked`) in the top bar; below `lg` it is an overlay Sheet. Content, in order of data availability (INVESTIGATE what student-facing data actually exists — messages/citations in student-chat schema, any course-source metadata query — and implement the richest layer that has real data; degrade in this order):
  a. If message citations exist in existing chat data: `CITED IN THIS SESSION` list — footnote rows (`source title — p. N`) grouped by source, each with `FileText` icon.
  b. Course source metadata if an existing student-facing query provides it: `COURSE SOURCES` list with status footnotes.
  c. If neither exists: the panel still ships with the `ABOUT THIS NOTEBOOK` block only: course name, mono code, member-since/assigned info from existing course data, plus the privacy line (`Private saved history` cue moves here from the conversation header).
  Report which layers shipped. Panel materiality: inset `rounded-2xl border bg-card shadow-sm m-3 ml-0`.
- **The Shelf** (`/student/courses`): full-page notebook picker. PageHeader (THE SHELF / `Your courses.`); grid of large notebook cards `rounded-3xl .hover-float p-8`: course tile, name `.display-3`, mono code, footnote meta, primary pill `Open notebook →` (routes into the workspace with that course selected — use the existing course-selection mechanism). This page is now the ONLY non-chat student page besides settings.

## F4. Instructor = the Notebook Manager (simplify)

Instructor keeps the studio shell (docs: staff get dashboards) but collapses pages:
- **Merge `my-courses` + `course-hero` into the Register dashboard**: the course panel IS the course view (one course per instructor in current data). Delete the separate my-courses page + route; sidebar loses that item. (If multiple courses exist in data, the course panel gets a switcher row — degrade per data.)
- Dashboard = Register per D5, with the course panel enriched: sources summary (count by status from existing dashboard data), `Open materials →` CTA, review-queue summary panel.
- **Materials page stays** (it is the notebook's sources manager): PageHeader + upload action; source cards per D5; add a `.smallcaps-label` status filter row (existing filter logic only — if none exists, static full list, report).
- **Review queue stays** (docs §7.6 — core loop). Rows per D5.
- Settings stays.

## F5. Admin = the Ledger (keep, tighten)

No flow changes. Apply F1/F2 sweeps; verify table pattern conformance from the v3 QA round; nothing else.

## F6. Simplification kill-list

- `student-dashboard-page.tsx` + its bento (Desk) — deleted (F3).
- Student studio sidebar/header as separate chrome — replaced by the rail + top bar (F3).
- `my-courses` instructor page — merged (F4).
- Any component left orphaned by the above: delete after import-grep.
- StatCards on student surfaces — gone with the dashboard. (Register/Ledger keep theirs.)

## F8. The Difference — Morshid is NOT NotebookLM (docs §7 addendum)

Per docs/project-description.md §7: Morshid's identity is **enforced Socratic guidance + instructor oversight**, narrower than both ChatGPT and NotebookLM. The UI must make that visible. Data-honest rule applies: implement what existing data supports; establish only vocabulary for the rest.

- **Guidance labels (REQUIRED — data exists)**: `chatMessageGuidanceLabelSchema` already ships `guidanceLabel` on messages; the chat UI currently ignores it. Render a meta row under the tutor bubble (`.footnote` line) with a label chip per value:
  - `COURSE_GROUNDED` → chip `GROUNDED IN COURSE SOURCES` — success wash (`bg-success/10 text-success border-success/25`), `FileText` icon.
  - `GENERAL_NOT_FOUND` → chip `GENERAL GUIDANCE · NOT FROM COURSE SOURCES` — neutral (`bg-secondary text-muted-foreground`), no icon.
  - `UNCERTAIN_AWAITING_REVIEW` → chip `AWAITING INSTRUCTOR REVIEW` — warning wash, `ClipboardCheck` icon. This is the docs-mandated visible warning (§7.6).
  - `INSTRUCTOR_REVIEWED` → chip `INSTRUCTOR-REVIEWED` — **the gold seal**: `bg-gold/10 text-gold border-gold/25`, `BookMarked` icon. This is gold's one earned ambient use (§7.5's label).
  - `null` → no meta row.
  Chips: pill, mono uppercase 0.6875rem (Badge idiom), one per message. Fixtures already exercise `COURSE_GROUNDED` — tests should assert the rendering.
- **Flagging affordance**: ONLY if an existing mutation/hook supports flagging; otherwise skip entirely (no dead buttons) and report. Same for the notifications bell (§5.3/§7.8): if no notifications data/hook exists, OMIT the bell — never render a fake affordance.
- **Hint-ladder & streaming (§7.12–7.13)**: no streaming/ladder data exists in the client yet — do NOT build UI for it; the bubble/meta-row vocabulary above is the extension point. Keep the existing optimistic-send/disabled-composer contracts untouched.
- **Limits/failure (§7.11)**: existing error/retry footers in message history are the pattern; verify they use ErrorState/retry affordances and preserve composed text where that behavior already exists.

## F9. Merge reconciliation — grounded-chat UI joins the manuscript (BINDING)

Context: dev merged PR #116 (grounded chat citations + retry) into this branch. The behavior, hooks, schema, copy, aria contracts, and test suites from that merge are LOAD-BEARING — do not change any behavior, query, aria-label, or user-facing sentence except where this section explicitly renames a presentation detail. This section restyles and de-duplicates presentation only.

- **F9.1 Citation renderings — from three to two.** A tutor message's citations currently render three times: (1) a plain badge row `[order] title` inside the bubble, (2) the `StudentCitationSources` accordion chips `[title, chunk N]` + evidence, (3) the session-wide Sources panel. Ruling:
  - DELETE rendering (1) (the `aria-label="Message citations"` badge row in `student-chat-message.tsx`). Its job moves to (2)'s chip row.
  - KEEP (2) `StudentCitationSources` as the per-message evidence surface, restyled: chip row becomes mono citation chips `[n] title` (`font-mono text-xs`, `border-primary/25 bg-primary/5 text-primary` — citations are one of blue's reserved uses per F1); accordion trigger icon `BookOpenCheck` → `BookMarked` (F2), `size-4 strokeWidth={1.75} text-muted-foreground`; evidence cards `bg-muted/40` → `bg-secondary/40 rounded-xl`, evidence excerpts adopt the panel's figure/blockquote idiom (`border-l-2 border-primary/30 pl-3`, `.footnote` mono figcaption `Source passage N`). All copy strings unchanged ("Sources (N)", "This source is no longer available. No excerpt is shown.", availability badges).
  - KEEP (3) the Sources panel exactly as merged (it is already on-spec).
  - Migrate tests that assert the deleted badge row deliberately and minimally; all other citation assertions must keep passing.
- **F9.2 Composer**: `rounded-[1.75rem]` (off the radius scale) → `rounded-2xl`; wrapper `border bg-card` → `glass-paper` + keep `p-2 shadow-md`; send button stays a `size-9 rounded-full` primary pill; error box `bg-muted/50` → `bg-secondary/60 rounded-xl`. Every behavior — draft limiting, clientMessageId, Enter-to-send, disabled logic, aria wiring, hint/error copy — byte-identical.
- **F9.3 Guidance chips**: the merged `guidancePresentation` map (incl. dev's new `REFUSAL` value, neutral) is APPROVED as the F8 implementation. No changes beyond what F9.1 touches around it.
- **F9.4 Icon straggler**: `instructor-layout.tsx` still imports lucide `Settings` → `Settings2` (F2). Verify by grep that no bare lucide `Settings` import remains anywhere in client/src.
- **F9.5 Sweep**: audit `student-ai-tutor/**` + `student-shell-page.tsx` + `student-top-bar.tsx` for merge-era off-spec styling: arbitrary radii not on the scale, `bg-muted` washes where `bg-secondary` is the warm idiom, ambient `text-primary` icons (F2), retry-footer styling (keep `Alert`/copy, ensure `rounded-xl` and warm tones). Report every touch.

## F7. QA bars (delta)

- Zero blue hover/selection states anywhere (only links/primary/focus/citations are blue) — verify by screenshot in both themes: dropdown open state, session hover+active, table row hover, select menu, command palette.
- Sources panel collapse/expand keeps a single scroll container; no layout shift of the reading column beyond the panel width.
- Student flow: sign-in → workspace in ONE hop (no dashboard interstitial); Shelf reachable and back.
- Tests updated to the new flow deliberately; behavioral/data assertions preserved. Existing test contracts around session list semantics and disabled composer keep passing.
