# Morshid — "The Annotated Page" Design Specification

**Author: Design Director (Fable). Status: BINDING. Implementing agents execute this verbatim — zero creative liberties. Where this spec is silent, choose the plainest editorial option consistent with it and list the decision in your report.**

## 0. Philosophy

Morshid is a Socratic tutor that reads the professor's own materials and cites the page. The website should look like the product's soul: **a beautifully typeset academic page, annotated in the margins** — not a SaaS template. Think a modern university-press book: warm paper, confident ink-black serif display type, hairline rules, footnotes, small-caps labels, one blue (ink) and one red (rubric) accent used sparingly. Print discipline, screen comfort.

**The signature motif is the citation footnote**: superscript markers (¹) in running text that resolve below a hairline rule to `1 — Lecture 08 · Quicksort — p. 12` in mono. Use it in the hero dialogue, feature figures, and nowhere gratuitously.

### Kill list (grounds for rejection if found on landing/auth)
- NO purple/indigo/violet gradients. NO gradient text. NO `.text-gradient-brand`.
- NO glassmorphism (`.surface-glass`, backdrop-blur cards), NO glow shadows, NO aurora/star-field backgrounds, NO floating ornament stars.
- NO centered-everything layouts; the grid is asymmetric and mostly left-aligned.
- NO fake logos, fake statistics (92%, 120k+), star-rating rows, or avatar clusters.
- NO rounded-3xl blobs. Radius is small and rare (see tokens).
- NO emoji, NO sparkles icons, NO "AI magic" iconography.
- The eight-point star survives ONLY inside the logo mark, small, monochrome ink.

## 1. Tokens (client/src/styles.css — replace current values)

Light — "Reading Room" (default):
```
--background:            oklch(0.9720 0.0080 85);   /* warm cream paper */
--foreground:            oklch(0.2400 0.0200 60);   /* warm ink black */
--card:                  oklch(0.9850 0.0060 85);   /* lifted paper */
--card-foreground:       = foreground
--popover:               oklch(0.9850 0.0060 85);
--popover-foreground:    = foreground
--primary:               oklch(0.4500 0.1900 264);  /* ink blue (ultramarine) */
--primary-foreground:    oklch(0.9800 0.0060 85);
--secondary:             oklch(0.9300 0.0120 85);   /* deeper paper */
--secondary-foreground:  = foreground
--muted:                 oklch(0.9300 0.0120 85);
--muted-foreground:      oklch(0.4600 0.0200 70);
--accent:                oklch(0.9050 0.0300 264 / 0.35 as solid ≈ oklch(0.9200 0.0180 264)); /* faint blue wash */
--accent-foreground:     oklch(0.4500 0.1900 264);
--destructive:           oklch(0.5400 0.1900 29);
--destructive-foreground: oklch(0.9800 0.0060 85);
--rubric:                oklch(0.5200 0.1900 29);   /* NEW token: rubrication red */
--rubric-foreground:     oklch(0.9800 0.0060 85);
--success:               oklch(0.5200 0.1200 150);
--warning:               oklch(0.6400 0.1300 75);
--info:                  oklch(0.5200 0.1000 240);
--gold:                  oklch(0.7000 0.1100 85);   /* demoted: tiny details only */
--border:                oklch(0.8700 0.0120 80);   /* warm hairline */
--input:                 oklch(0.8700 0.0120 80);
--ring:                  oklch(0.4500 0.1900 264);
--radius:                0.375rem                    /* rounded-md = 6px; cards may use md, controls sm; NOTHING above lg except avatars (full) */
```
Dark — "Lamplight" (warm dark, never blue-black):
```
--background:            oklch(0.2080 0.0120 60);
--foreground:            oklch(0.9300 0.0100 85);
--card:                  oklch(0.2420 0.0130 60);
--popover:               oklch(0.2420 0.0130 60);
--primary:               oklch(0.7200 0.1200 264);
--primary-foreground:    oklch(0.2080 0.0120 60);
--secondary / --muted:   oklch(0.2750 0.0140 60);
--muted-foreground:      oklch(0.6800 0.0180 75);
--accent:                oklch(0.3000 0.0300 264);
--accent-foreground:     oklch(0.7800 0.0900 264);
--rubric:                oklch(0.6800 0.1600 30);
--border / --input:      oklch(0.3300 0.0150 65);
--ring:                  oklch(0.7200 0.1200 264);
(success/warning/info/gold: raise L ≈ +0.15, lower C slightly; destructive oklch(0.6600 0.1800 25))
```
Charts: 1=primary, 2=rubric, 3=gold, 4=success, 5=info. Sidebar tokens mirror background/card family.

**Shadows:** near-elimination. `--shadow-*`: keep only `shadow-xs = 0 1px 2px oklch(0.2 0.02 60 / 0.06)` and `shadow-sm = 0 1px 3px / 0.08`; md/lg/xl for overlays only `0 8px 24px / 0.12`. Depth comes from hairline borders and paper-tone shifts, never glow. DELETE `.shadow-glow-primary`.

**Utilities:** DELETE `.surface-glass`, `.text-gradient-brand`, `.bg-star-field`, `.bg-radial-spot`, `.bg-grid-faint`, `.shadow-glow-primary`, `animate-aurora`, `animate-float`, `animate-star-spin` (grep the whole client and remove/replace all usages — replace with plain paper surfaces or delete the decoration). KEEP `.scrollbar-themed`, `.shimmer`, fade keyframes.
**ADD utilities:**
- `.rule` → `border-top: 1px solid var(--border)` ; `.rule-strong` → `2px solid var(--foreground)`.
- `.smallcaps-label` → mono font, `font-size: 0.6875rem`, `letter-spacing: 0.14em`, `text-transform: uppercase`, `color: var(--muted-foreground)`.
- `.footnote` → mono, 0.75rem, muted-foreground.
- `.rubric-square` → inline-block 0.5em square background `var(--rubric)` (the tiny red square that precedes eyebrows).
- `.link-editorial` → underline, `text-underline-offset: 4px`, `text-decoration-thickness: 1px`, `text-decoration-color: var(--border)`; hover: `text-decoration-color: var(--rubric)`; color inherits.
- `@theme` font vars: `--font-display: 'Fraunces Variable', Georgia, serif` (use `font-variation-settings: 'opsz' 144` at display sizes, `'SOFT' 0, 'WONK' 0`); `--font-sans: 'Geist Variable'`; `--font-mono: 'Geist Mono Variable', ui-monospace` → **install `@fontsource-variable/geist-mono`**.

## 2. Typography

- Display (Fraunces, weight 560–620, opsz max, tracking -0.015em, leading 1.02):
  - `display-1` hero: `clamp(3.25rem, 7vw, 6.75rem)`
  - `display-2` section: `clamp(2.25rem, 4vw, 3.75rem)`
  - `display-3` card/panel: `1.75rem`
- Body: Geist 1rem/1.65 (marketing prose `1.0625rem`), max measure `65ch`.
- Labels/eyebrows/footnotes/numbers: Geist Mono via `.smallcaps-label` / `.footnote`; numbers `tabular-nums`.
- Italic: Fraunces italic for pull-quotes and speaker emphasis ONLY. Never italic gradient words.
- Headline punctuation: sentences end with a period. It is a voice signature.

## 3. Grid & spacing

- Content container: `max-w-6xl` (72rem), horizontal padding `px-6 md:px-10`.
- The page is sectioned by full-width hairline rules (`.rule`). Sections: `py-24 md:py-32`.
- 12-col asymmetry: hero text spans 7 cols, artifact 5; feature rows 4+8; never symmetric halves except auth.
- Section headers: mono index + rubric square + small-caps eyebrow, then display-2, left-aligned, `max-w-[20ch]`.

## 4. Component specs (primitives)

- **Button**: radius `rounded-md`. Sizes unchanged. Variants:
  - `default` (primary CTA): `bg-foreground text-background`, hover `bg-primary text-primary-foreground` (ink turns blue when inked), active translate-y-px. No glow, shadow-xs only.
  - `outline`: 1px border-foreground/25, transparent bg, hover border-foreground bg-transparent.
  - `secondary`: bg-secondary. `ghost`, `link` (use `.link-editorial` styling), `destructive` conventional.
- **Card**: `rounded-md border bg-card shadow-none`; NO hover-lift on marketing pages (allowed subtle `hover:border-foreground/30` where interactive).
- **Badge**: rectangular `rounded-sm`, mono uppercase 0.6875rem tracking 0.08em; variants map to semantic tokens with soft washes (e.g. success = `bg-success/10 text-success border border-success/25`). Add a `rubric` variant.
- **Input**: app surfaces keep boxed inputs (rounded-md, border-input, focus ring-1 ring-ring). Auth uses the **RuledField** pattern (see §6) built locally from Input with `border-0 border-b rounded-none px-0` — do not fork the primitive.
- **Navbar/footer/chrome**: see per-page specs.
- Everything else in ui/: mechanically apply radius/shadow/token swap; no structural changes.

## 5. Landing page — exact composition (client/src/features/landing/)

Delete-and-rebuild. Files: keep `landing-page.tsx` as composition root; replace section components (delete cta-section/testimonials-section/how-it-works-section/trust-logos-section/guiding-star usage; new files below). All copy VERBATIM as written here.

### 5.1 Masthead (components/layout/navbar.tsx — rebuild)
Paper bg (`bg-background/95 backdrop-blur-sm` allowed for stickiness only), bottom `.rule`. Height 64px. Left: logo mark (ink, 24px) + "Morshid" in Fraunces 600 1.25rem. Center-right links (`.smallcaps-label`, foreground on hover): "The Method", "For Instructors", "Sign in". Far right: Button default "Begin studying". Mobile: links collapse into a plain sheet menu, same typography.

### 5.2 Hero — "Section 01"
Container top padding `pt-20 md:pt-28`, bottom `pb-24`. Grid `lg:grid-cols-12 gap-12`.
**Left (cols 1–7):**
- Eyebrow row: `.rubric-square` + `.smallcaps-label` text: `A SOCRATIC TUTOR, BOUND TO YOUR COURSE`
- H1 `display-1` font-display: `Every answer has a page number.`
- Paragraph (max-w-[52ch], muted-foreground, 1.125rem): `Morshid reads the syllabus, slides, and notes your professor actually assigned — then tutors you the Socratic way: asking before answering, and citing the page when it does.`
- CTA row (gap-6, items-baseline): Button default lg `Begin studying` ; anchor `.link-editorial` mono text-sm `Read the method ↓` scrolling to §5.4.
**Right (cols 8–12): "The transcript"** — NOT a chat app window. A typeset dialogue on `bg-card` with 1px border, rounded-md, `p-8`, header row: `.smallcaps-label` `TRANSCRIPT — DATA STRUCTURES, WEEK 8` + small ink logo mark right-aligned. Body is typeset like a printed Socratic dialogue:
```
STUDENT.   (smallcaps-label, rubric color)
Why does quicksort average O(n log n)?   (font-display italic 1.25rem, foreground)

MORSHID.   (smallcaps-label, primary color)
Let us reason it out. If each pivot splits the array roughly in
half, how many times can you halve n before reaching 1?¹   (body 1rem, leading-relaxed; the ¹ is a superscript link-styled in primary)

STUDENT.
About log n times.

MORSHID.
Exactly — and every level touches each element once. So what is
the total work?²
```
Below: `.rule`, then footnotes block, each line `.footnote`: `1 — Lecture 08 · Quicksort — p. 12` and `2 — Problem Set 3 · Analysis — p. 4`. 
Animation (the ONLY hero motion): the dialogue lines fade-up in sequence on load, 120ms stagger, and the two footnote lines fade in last; `motion-safe` only, no loop, no typing carets.

### 5.3 Credo rule-strip
Full-width, `.rule` top+bottom, `py-5`. One row (wraps on mobile), `.smallcaps-label` items separated by `·` : `GROUNDED IN YOUR SYLLABUS · CITED TO THE PAGE · SOCRATIC BY METHOD · READY THE NIGHT BEFORE THE EXAM`. No logos, no claims of institutions.

### 5.4 The Method — "Section 02" (new file method-section.tsx)
Section header: mono index `02` (Fraunces, 1.5rem, muted) + eyebrow `THE METHOD` + display-2: `It teaches the way good teachers do.`
Then three rows, each `.rule`-separated, grid 12: cols 1–1 mono index (`01`—`03` Fraunces display-3 muted), cols 2–6 title display-3 + prose (muted-foreground, max-w-[48ch]), cols 8–12 a "figure": bordered `bg-card p-6` mini-artifact with a `.footnote` caption `fig. 1 — …` under it.
- Row 01 title `It asks before it answers.` prose: `Handing you the answer would be the fastest way to make you forget it. Morshid poses the next question — the one that walks you to the answer yourself.` figure: two typeset dialogue lines (STUDENT./MORSHID. as §5.2 style, shortened). caption `fig. 1 — the Socratic turn`.
- Row 02 title `It reads what your professor assigned.` prose: `No open-web guessing, no generic textbook voice. Your course's own syllabus, slides, and notes are the entire universe of every answer.` figure: a stacked "shelf" list of three mono file rows (`syllabus.pdf · 24 pp` / `lecture-08-quicksort.pdf · 31 pp` / `problem-set-3.pdf · 6 pp`) each with a small `INDEXED` badge (success variant). caption `fig. 2 — the shelf`.
- Row 03 title `It cites the page, every time.` prose: `Every claim carries a superscript. Every superscript resolves to a page you can open. If Morshid cannot cite it, Morshid will not say it.` figure: one body sentence containing ³ then `.rule` and footnote `3 — Lecture 08 · Quicksort — p. 12` with a rubric-colored `p. 12` . caption `fig. 3 — the receipt`.

### 5.5 The Course of Study — "Section 03" (new file course-section.tsx)
Header: index `03`, eyebrow `FROM SHELF TO SESSION`, display-2: `Three steps, then it knows the course.`
One horizontal `.rule` spanning the container; on it, three columns (grid-cols-1 md:grid-cols-3 gap-10, pt-10). Each: roman numeral in Fraunces display-3 (`i.` `ii.` `iii.`), title 1.125rem font-medium, prose muted. 
- `i. Shelve` — `An instructor uploads the syllabus, lecture slides, and notes. Morshid reads and indexes every page.`
- `ii. Ask` — `Pose the question the way you would to a colleague. Plain language is enough.`
- `iii. Understand` — `Arrive at the answer yourself, one question at a time — with the page numbers to prove it.`

### 5.6 Marginalia — pull-quote section (new file marginalia-section.tsx)
`.rule` top. `py-24`. Grid 12: cols 2–10. An oversized Fraunces italic quote, display-2 size, foreground: `“It feels less like a search engine and more like a colleague who has read every page of the syllabus.”` Below, `.footnote`: `— from an early instructor pilot`. A 2px `rule-strong` sits 3rem above the quote, width 3rem (a printer's dash). Nothing else. No cards, no stars, no stats.

### 5.7 Colophon CTA — "Section 04" (new file colophon-cta-section.tsx)
Full-bleed band `bg-foreground text-background` (ink page, inverted), `py-24`. Container grid 12: cols 1–8: display-2 in Fraunces: `Bring the course. Keep the understanding.` + one sentence `text-background/70`: `Free for students on any course an instructor has shelved.` Cols 9–12 right/bottom-aligned: Button (inverted: `bg-background text-foreground hover:bg-primary hover:text-primary-foreground`) lg `Begin studying`.

### 5.8 Footer (components/layout/footer.tsx — rebuild)
Paper bg, `.rule` top. Three mono small-caps columns (Product / Company / Legal) with `.link-editorial` links (keep existing link targets), left block: logo + one line `Morshid — a Socratic tutor bound to course materials.` Bottom row: `.rule` then `.footnote`: `© 2026 Morshid · Set in Fraunces & Geist · All systems operational` (keep the status dot, success color).

## 6. Auth (client/src/features/auth/) — exact composition

Rebuild `auth-layout.tsx`, `auth-branding-panel.tsx`, `sign-in-page.tsx`; restyle `sign-in-form.tsx`, `password-field.tsx` (logic, schema, handlers, aria wiring UNCHANGED).

Layout: `lg:grid-cols-2`, full height.
**Left panel — the title page** (`bg-foreground text-background` ink, hidden below lg): centered column, generous vertical rhythm, all centered (the ONE centered composition in the site — title pages are centered):
- small logo mark, `text-background`
- `.rule-strong` in background/30, width 4rem
- "MORSHID" in Fraunces, 3rem, letter-spacing 0.35em (spaced capitals, no gradient)
- `.smallcaps-label` in background/60: `A SOCRATIC TUTOR, BOUND TO YOUR COURSE MATERIALS`
- `.rule-strong` again
- bottom of panel, `.footnote` in background/40: `EST. MMXXVI · EVERY ANSWER HAS A PAGE NUMBER`
No testimonials, no avatars, no floating stars, no radial glows.
**Right panel — the form on paper**: centered vertically, `max-w-sm` column, left-aligned text:
- `.smallcaps-label`: `SIGN IN`
- Fraunces display-3 2rem: `Welcome back.`
- one muted sentence: `Your sessions and citations are where you left them.`
- Form fields as **RuledField**: label `.smallcaps-label` above; input `border-0 border-b border-input rounded-none px-0 bg-transparent h-11 text-base`, focus: `border-b-2 border-foreground` (no ring); error: `border-rubric` + existing error text (rubric color). Password keeps the reveal eye (ghost, right, inside baseline).
- "Forgot password?" as `.link-editorial` mono text-xs, right-aligned on the password label row.
- Submit Button default full-width: `Sign in`. Below, `.footnote`: `New to Morshid? Ask your instructor for access.`
- Error alert: `.rule`-boxed (1px border-rubric/40 bg-rubric/5 text-rubric rounded-md) with icon.
Mobile: title-page panel hidden; a compact masthead (logo + Morshid wordmark) above the form.

## 7. App surfaces (student / instructor / admin / chrome) — coherence pass only

Structure stays. Mechanical de-slop to match tokens:
- Grep and eliminate everywhere: gradient backgrounds (`bg-gradient-*`, `from-*via-*to-*` decorative uses), deleted utilities (§1), glow shadows, star ornaments (GuidingStar usages OUTSIDE the logo — delete `components/guiding-star.tsx` and all imports; tutor avatar in chat becomes the ink logo mark on `bg-primary/10 text-primary` rounded-full), `rounded-2xl/3xl` → `rounded-md/lg`, `font-display` on non-display sizes.
- Chat: student bubble = `bg-accent text-foreground border rounded-md` (square-ish, editorial); tutor = `bg-card border rounded-md`; citations/chips already mono — keep. System notes = `.footnote` centered.
- Dashboard heroes (student continue-learning, instructor course-hero): replace star-field/gradient panels with `bg-card border rounded-md` + left `rule-strong` accent bar in rubric, display-3 Fraunces heading.
- Sidebars/headers: paper tones, active item = `bg-accent text-accent-foreground` with a 2px left rubric bar, `.smallcaps-label` group headings.
- StatCard chips: keep tone prop; chip backgrounds become `bg-<tone>/10 text-<tone>` squares `rounded-sm`.
- Settings/tables/dialogs inherit token+primitive changes; fix anything that visually breaks.

## 8. Motion

Global: durations 150–250ms, `ease-out`. Allowed: fade/translate-y-2 entrances (hero dialogue stagger, section-header fade on scroll ONCE), underline color transitions, button active nudge. Forbidden: parallax, aurora, floating loops, typing carets, scale-hovers > 1.01. All entrances `motion-safe:`.

## 9. Accessibility & QA bars

- AA contrast both themes (mind `muted-foreground` on `background`: keep L-distance ≥ 0.45; rubric/primary on paper both pass at stated values).
- Focus-visible: 2px ring-ring offset-2 everywhere interactive; `.link-editorial` focus gets ring too.
- Landing must be flawless at 390px, 768px, 1440px. Transcript wraps, never overflows.
- Dark mode is first-class: verify every section in both themes via screenshots before reporting done.

## 10. Tests

Copy changed wholesale — update any test asserting old innertext/labels to the new copy in this spec (navbar links, sign-in headings, landing text, role-placeholder, status page untouched). Behavioral assertions (aria, handlers, routing) must keep passing unchanged.
