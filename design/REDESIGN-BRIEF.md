# Morshid — Visual Redesign Brief (Phase 1 → Phase 2 contract)

This document is **binding** for all Phase 2 page teams. It defines the Morshid
design language: brand, tokens, typography, motion, components, and per-surface
art direction. If it isn't specified here, prefer restraint and match the spirit
of what _is_ specified. Three teams build in parallel — coherence comes from
everyone using the **same tokens and utilities** below, never ad-hoc hex/px.

---

## 1. Brand concept & personality

**Morshid ("مرشد" — the guide) is the Guiding Star.** The identity fuses two
ideas: the _intelligence_ of a deep indigo night sky, and the _illumination_ of
an eight-pointed star (the Rub el Hizb of Arabic geometry) rendered in warm
manuscript gold. The product should feel like a **calm, premium study
companion** — scholarly and trustworthy, but modern and quietly futuristic.

Personality: **confident, focused, warm, precise.** Never loud, never
default-shadcn, never generic-SaaS-blue. Depth and motion are used with
discipline; the star motif appears sparingly (logo, empty states, hero/footer
backgrounds) and never as decoration-for-its-own-sake.

Three-sentence pitch: _Morshid is an AI tutor that guides students through their
own course material, Socratically. The interface pairs a deep-indigo intellect
with illuminated-gold accents and a recurring eight-pointed guiding-star motif.
It reads as a world-class, disciplined product — expressive on marketing
surfaces, warm and focused for students, calm and dense for staff._

---

## 2. Token reference

All tokens are CSS variables wired through Tailwind v4 `@theme` in
`client/src/styles.css`. **Use the Tailwind utility, not the raw variable**
(e.g. `bg-primary`, `text-muted-foreground`, `border-border`). Colors are OKLCH.
The default preset (`:root` / `.dark`) **is the brand** — the four alternate
presets (slate/emerald/rose/amber) are a pre-existing user preference feature;
design for `default` and let the others inherit.

### Core semantic colors (utility → meaning)

| Utility base                          | Role                                               |
| ------------------------------------- | -------------------------------------------------- |
| `background` / `foreground`           | App canvas / primary text (indigo-ink, not black)  |
| `card` / `card-foreground`            | Raised surfaces, panels                            |
| `popover` / `popover-foreground`      | Menus, dialogs, toasts                             |
| `primary` / `primary-foreground`      | **Indigo** — CTAs, active nav, focus, brand fills  |
| `secondary` / `secondary-foreground`  | Light neutral chips/buttons (NOT dark — see below) |
| `muted` / `muted-foreground`          | Subtle fills / secondary text                      |
| `accent` / `accent-foreground`        | Hover/active subtle surfaces (indigo-tinted)       |
| `border` / `input` / `ring`           | Hairlines / field borders / focus ring             |
| `destructive` (+`-foreground`)        | Errors, destructive actions                        |
| `success` (+`-foreground`)            | **NEW** — ready/approved/online/complete           |
| `warning` (+`-foreground`)            | **NEW** — pending/draft/degraded                   |
| `info` (+`-foreground`)               | **NEW** — informational                            |
| `gold` (+`-foreground`)               | **NEW** — the "guiding star" brand accent, sparing |
| `chart-1..5`                          | Data viz (indigo, teal, gold, rose, blue)          |
| `sidebar*`                            | Sidebar surface family (mirrors core)              |

> **Semantic change to note:** `secondary` is now a **light** neutral surface
> (standard shadcn semantics), not the old dark chip. `secondary` buttons/badges
> read as quiet neutral controls. Use `default` (indigo) for primary emphasis.

### Approx. values (for reference — always use the utility)

- Light: bg `oklch(0.994 0.002 275)`, fg `oklch(0.21 0.028 274)`,
  primary `oklch(0.515 0.196 275)`, gold `oklch(0.76 0.13 76)`.
- Dark: bg `oklch(0.175 0.018 274)` (deep indigo night — never `#000`),
  card `oklch(0.213 0.021 274)`, primary `oklch(0.585 0.196 274)`,
  gold `oklch(0.8 0.13 78)`.

Both themes are tuned for **WCAG AA**. `muted-foreground` passes AA for body
text on `background`/`card`. Don't put `muted-foreground` on `muted` fills for
long text.

### Radius

`--radius: 0.75rem`. Scale: `rounded-sm` 8px · `rounded-md` 10px ·
`rounded-lg` 12px (buttons, inputs) · `rounded-xl` 14px (cards, dialogs) ·
`rounded-2xl` 16px (hero panels). Badges stay pill (`rounded-4xl`). **Do not**
introduce other radii; keep the family consistent.

### Elevation (shadows now render — the old ones were 0-opacity)

Indigo-tinted in light, deep black in dark. Ramp:
`shadow-2xs` → `shadow-xs` → `shadow-sm` → `shadow` → `shadow-md` →
`shadow-lg` → `shadow-xl` → `shadow-2xl`.

Usage: resting **cards `shadow-sm`**, buttons `shadow-xs`, dropdowns/popovers
`shadow-md`, sheets/dialogs `shadow-lg`–`shadow-xl`, hero/marketing lifts
`shadow-2xl`. Prefer **`ring-1 ring-foreground/8` + `shadow-sm`** for card
crispness (that's the Card default). Don't stack heavy shadows on dense tables.

### Spacing rhythm

Base unit `--spacing: 0.25rem` (Tailwind default). Rhythm: **4 / 6 / 8** for
component internals, **12 / 16 / 20 / 24** for section gaps. Page gutters:
`px-4 sm:px-6 lg:px-8`. Content max-widths: marketing `max-w-7xl`, reading/forms
`max-w-2xl`–`max-w-3xl`, dashboards `max-w-7xl`.

---

## 3. Typography

Two families, installed and wired:

- **Geist Variable** (`font-sans`) — **all UI, body, labels, data, buttons.**
  This is the default `body` font. Numeric/tabular data may use `tabular-nums`.
- **Fraunces Variable** (`font-display` **and** `font-serif`) — **expressive
  display headlines only.** A high-contrast manuscript serif with automatic
  optical sizing (`font-optical-sizing: auto` is on globally, so large sizes get
  the gorgeous high-contrast cut for free). Italic is available and is a real
  design axis — use `italic` on a highlighted word for editorial flair.
- **Mono** (`font-mono`) — system mono stack; code, citations, IDs.

**Where each goes:**

| Context                                         | Font                       |
| ----------------------------------------------- | -------------------------- |
| Landing hero H1, big marketing section titles   | `font-display` (Fraunces)  |
| Auth branding headline                          | `font-display`, may italic |
| Empty-state / hero pull quotes (optional)       | `font-display`             |
| Page titles, card titles, dashboard headings    | `font-sans` (Geist)        |
| All body, nav, buttons, tables, forms, badges   | `font-sans`                |
| Code, token IDs, citation refs                  | `font-mono`                |

**Rules:** Fraunces is for **size ≥ ~1.5rem display moments**, never body,
labels, buttons, or table content. Headline tracking is slightly tight
(`-0.01em`, applied automatically to `.font-display`/`.font-serif`). Keep body
line-height generous (`leading-6`/`leading-relaxed`). Don't mix Fraunces and
Geist in the same heading. Suggested display scale: hero
`text-5xl`→`text-7xl`, section `text-3xl`→`text-4xl`.

Brand headline gradient available: **`.text-gradient-brand`** (indigo → violet →
gold). Use on ONE headline or a highlighted phrase per view — not everywhere.

---

## 4. Motion

Easings (Tailwind utilities): **`ease-out-quart`** (default UI),
**`ease-out-expo`** (entrances/emphasis), **`ease-spring`** (playful pop, use
rarely). Durations: **150ms** micro (hover/press), **200–300ms** standard
(enter/leave, expand), **≥500ms** only for hero/marketing reveals.

Prebuilt animations: `animate-fade-up`, `animate-fade-in`, `animate-float`
(hero ornament drift), `animate-aurora` (gradient pan for hero backgrounds),
`animate-star-spin` (very slow logo/motif rotation). Skeletons use the
**`.shimmer`** utility (already baked into `<Skeleton>`).

**What animates:** hover/press feedback (color, subtle shadow, `translate-y-px`
on press — built into buttons); nav underline reveal; dialog/sheet/dropdown
enter-leave (handled by primitives); staggered `fade-up` for landing sections;
skeleton shimmer. **What does NOT:** dense table rows, form fields mid-typing,
anything that would distract during focused study or data review.

**`prefers-reduced-motion` is respected** globally — all brand keyframes and
shimmer collapse to none. If you add bespoke motion, gate big movement behind
`motion-reduce:` or the media query. The theme-switch ripple already honors it.

---

## 5. Component usage patterns

All primitives live in `client/src/components/ui` (+ `ui/custom`). **APIs,
props, and variant names are stable — do not fork them.** Compose, don't
re-style from scratch.

- **Buttons** (`<Button variant size>`): hierarchy per view = **one `default`
  (indigo) primary action**, `outline`/`secondary` for secondary, `ghost` for
  tertiary/toolbar/icon, `link` for inline, `destructive` for delete/danger.
  Sizes `xs`/`sm`/`default`/`lg` + `icon*`. Buttons carry `shadow-xs` and press
  feedback already.
- **Cards** (`<Card>`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/
  `CardFooter`/`CardAction`): default resting look = `shadow-sm` +
  `ring-foreground/8`. `size="sm"` for dense dashboards. Footers get a muted
  bar automatically. Add `hover:shadow-md transition-shadow` only for clickable
  cards.
- **Tables** (`<Table>` family): headers are now small, `muted-foreground`,
  tracked — a calm data-first look. Rows hover-highlight; header rows don't.
  Use `<StatusBadge>` in status columns. Keep tables on `card`, avoid heavy
  shadows; let the container `ring`/`border` frame them.
- **Badges** (`<Badge variant>`): `default` (indigo), `secondary`, `outline`,
  `ghost`, `destructive`, **`success`**, **`warning`**, **`info`**, `link`.
  Prefer **`<StatusBadge status=…>`** for entity states (it maps
  active/ready→success-ish, pending/draft→neutral, failed/offline→destructive).
  Use `success`/`warning`/`info` directly for readiness, review states, health.
- **Inputs / forms**: `<Input>` has subtle depth, hover-border, and a strong
  focus ring. Use the `<Form>` primitives + `<FormActions>`; keep labels above
  fields; error text via `aria-invalid` styling (built in).
- **Empty states** (`<EmptyState>`): branded — icon sits in a primary-tinted
  rounded badge over a faint star-field. Always give a `title`, usually a
  `description` and a primary `action`. This is a **brand moment** — write warm,
  guiding copy.
- **Error states** (`<ErrorState>`): destructive-tinted icon badge, `onRetry`
  wired to refetch. Use for query failures.
- **Loading**: `<Skeleton>` (shimmer) for content placeholders that mirror final
  layout; `<CubeLoader>` for full-page/branded loading (it's token-driven and
  renders in `foreground`). Prefer skeletons over spinners for perceived speed.
- **Dialogs / Sheets**: use for focused tasks; both have polished
  enter/leave + close affordances. Mobile nav and side panels → `<Sheet>`.
- **Toasts** (`sonner` `<Toaster>`): success/info/warning/error icons themed.
  Keep messages short; one action max.

### Reusable brand utilities (defined in `styles.css`)

| Utility                 | Use for                                                        |
| ----------------------- | ------------------------------------------------------------- |
| `.surface-glass`        | Sticky navbars, floating toolbars, command palette            |
| `.text-gradient-brand`  | One hero/headline phrase (indigo→violet→gold)                 |
| `.shadow-glow-primary`  | Hero CTA / focused brand element glow                          |
| `.bg-grid-faint`        | Subtle rule grid behind hero / section backgrounds            |
| `.bg-radial-spot`       | Soft primary spotlight behind hero content                    |
| `.bg-star-field`        | Tessellating eight-point-star texture (mask, primary-tinted). Pair with a radial `mask-image` fade + low opacity |
| `.scrollbar-themed`     | Opt-in themed scrollbar on tall scroll regions                |
| `.shimmer`              | Custom skeleton shapes (Skeleton already uses it)             |

Star-field pattern for backgrounds: `bg-star-field opacity-30
[mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]` inside a
`relative overflow-hidden` container, content wrapped `relative`.

---

## 6. Per-surface art direction

### A. Landing + Auth — _expressive / marketing_

Confident and editorial. **Fraunces display H1** (consider one
`.text-gradient-brand` or `italic` accent word). Layer depth: `.bg-radial-spot`
+ `.bg-grid-faint` and/or `.bg-star-field` behind the hero; `.surface-glass`
navbar (already built). Big whitespace, `max-w-7xl`, staggered `animate-fade-up`
section reveals, `shadow-2xl` product mockups, `shadow-glow-primary` on the main
CTA. Gold used as a sparing highlight (star ornaments, underlines). Auth uses
the branding panel (Fraunces headline, radial glow, logo). This is the one place
to be visually bold — but still disciplined.

### B. Student surfaces (dashboard, courses, **AI-tutor chat**) — _warm, focused, chat-first_

Calm and inviting; reduce chrome, maximize focus. Generous line-height, soft
`accent`/`muted` fills, rounded-xl cards with gentle `shadow-sm`. The **AI-tutor
chat is the flagship**: a distraction-free column, clear student-vs-tutor
message treatment (tutor messages may carry a subtle primary/gold edge or the
star mark as an avatar), grounded-citation chips in `mono`/`info`, a composer
that feels tactile and safe. Empty/first-run states are warm brand moments
(star-field empty states, guiding copy). Warmth = slightly more `gold`/`accent`
than staff surfaces; motion stays quiet so studying isn't disrupted.

### C. Instructor + Admin dashboards — _calm, dense, data-first_

Efficient and legible over expressive. `size="sm"` cards, tight vertical rhythm,
the muted table-header treatment, `<StatScard>`/`<StatusBadge>` for KPIs and
states. Use **`success`/`warning`/`info`/`destructive`** consistently for
readiness, review queue, and health so status reads at a glance. Sidebar uses
the `sidebar*` tokens with a solid indigo active pill (already wired via
`app-sidebar`). Minimal decorative motif — maybe one faint star-field in an
empty state. No hero gradients, no display serif in tables; Fraunces only for a
top-level page/section title if at all. Depth is functional (elevation to
separate layers), never showy.

---

## 7. Do / Don't

**Do**

- Use tokens and the utilities above; keep the palette, radius, and elevation
  families consistent across all three surfaces.
- Reserve **Fraunces** for display, **gold** for sparing accents, the **star
  motif** for logo/empty/hero only.
- Design and verify **both light and dark**; hit WCAG AA; keep visible focus
  rings.
- Lead with one clear primary action per view; let hierarchy come from color +
  size + weight, not decoration.
- Honor `prefers-reduced-motion`; keep dense/data and study surfaces quiet.

**Don't**

- Don't hardcode hex/rgb/px colors or shadows, or invent new radii.
- Don't edit shared chrome (`logo.tsx`, `navbar.tsx`, `footer.tsx`,
  `app-sidebar.tsx`, `dashboard-header.tsx`, `mode-toggle.tsx`) or rename/fork
  `ui/**` primitive APIs, props, or variant keys.
- Don't use pure black/white surfaces in dark mode (use `background`/`card`).
- Don't put Fraunces in body, buttons, labels, or tables.
- Don't over-apply gold, gradients, glows, or the star field — restraint is the
  brand.
- Don't animate table rows, live-typing fields, or anything that distracts
  during focused work.

---

## 8. Files owned by Phase 1 (do not edit in Phase 2)

`client/src/styles.css` · `client/src/components/logo.tsx` ·
`client/src/components/layout/{navbar,footer,app-sidebar,dashboard-header}.tsx` ·
`client/src/components/ui/mode-toggle.tsx` · all polished primitives under
`client/src/components/ui/**`. Extend via composition and the tokens/utilities
above.
