# Morshid theme and typography research

**Recommendation status:** Ready for design implementation

**Research date:** 2026-08-11

## Executive recommendation

Adopt a visual direction called **Guided Ink**:

- A dark-first study environment built from midnight ink, blue-grey surfaces, and warm off-white text.
- A warm paper light theme for longer reading and daylight use.
- Mineral teal as the single brand/action color: calm, directional, and clearly separate from error states.
- Amber as an annotation/progress color and coral only for destructive or error states.
- Quiet editorial details—hairline rules, marginal notes, citation markers, and generous type hierarchy—instead of gradients, glassmorphism, or neon decoration.

Use this typography system:

| Role | Recommendation | Where it belongs |
| --- | --- | --- |
| UI, navigation, chat, forms | Geist Sans Variable | All operational product surfaces and readable assistant content |
| Display and brand voice | Fraunces Variable | Landing hero, wordmark, major marketing headings, occasional lesson/title moments |
| Code and technical metadata | Geist Mono Variable | Code blocks, file names, course codes, citations, technical status labels |
| Arabic UI/content fallback | Noto Sans Arabic UI, with Noto Sans Arabic for longer prose | Arabic labels, controls, and future localization |

This is a fit-for-Morshid recommendation, not a claim that one palette or typeface is universally best. The evidence below establishes constraints and font capabilities; the visual direction and token values are design inferences from those constraints and from the product context.

## Repository context

Morshid is a course-grounded Socratic tutor for ITI/higher-education students. The product needs to make guidance, citations, uncertainty, review status, and code diagnosis easy to scan without feeling like a toy. The project documentation calls for a mobile-responsive, sidebar-driven conversation interface, a dark/light theme, and a polished landing page ([project description](project-description.md), [project pitch](project-pitch.md)).

The repository already has the right typographic ingredients:

- [`client/package.json`](../client/package.json) already includes `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`, and `@fontsource-variable/fraunces`.
- [`client/src/styles.css`](../client/src/styles.css) already expresses an “annotated page” / reading-room idea with warm paper, ink, editorial rules, and a warm dark “lamplight” mode.
- The current [theme provider](../client/src/providers/theme-provider.tsx) supports light, dark, and system modes.

The research therefore supports an evolution of the current direction rather than a wholesale rebrand. One implementation discrepancy should be resolved separately: the product documentation says the interface defaults to dark, while the provider currently uses `defaultTheme="system"`. The final product decision should be explicit and tested in both modes.

## What the primary sources establish

| Finding | Source | Morshid implication |
| --- | --- | --- |
| Normal text needs at least 4.5:1 contrast; large text needs at least 3:1. The ratio is based on luminance, not hue. | [W3C WCAG 2.2, SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Do not use teal, amber, or coral as text colors until the actual foreground/background pair is tested. Aim above the minimum for body copy. |
| Visual information needed to identify controls and states needs at least 3:1 against adjacent colors. | [W3C WCAG 2.2, SC 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) | Input borders, selected states, icons, dividers that carry meaning, and focus indicators need deliberate contrast tokens. |
| Color cannot be the only way to communicate meaning. | [W3C WCAG 2.2, SC 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) | Statuses such as course-grounded, uncertain, reviewed, warning, and error need text, icons, shape, or patterns in addition to color. |
| Keyboard focus must be visible; W3C also documents a two-color focus technique for difficult backgrounds. | [W3C WCAG 2.2, SC 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) | Use a persistent `:focus-visible` outline with a dedicated focus color. Never let the brand palette remove the browser-visible focus cue. |
| User-triggered motion should respect `prefers-reduced-motion`. | [W3C Technique C39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39) | Keep the existing motion direction, but make theme transitions, landing reveals, and decorative movement static when reduced motion is requested. |
| Text must survive user spacing overrides: 1.5 line height, 2x paragraph spacing, and wider letter/word spacing. | [W3C WCAG 2.2, SC 1.4.12](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) | Avoid fixed-height text containers and clipped headings. Do not make the editorial treatment dependent on tight tracking. |
| A useful advanced readability target is no more than 80 characters per line, no full justification, and reflow at 200% text size. | [W3C WCAG 2.2, SC 1.4.8](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html) and [SC 1.4.4](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) | Keep assistant prose and source excerpts around 60–75 characters where practical, use relative units, and test at 200% zoom. SC 1.4.8 is AAA, so this is a quality target rather than an MVP claim. |
| A responsive type scale should be tested across devices, use relative units, and maintain a consistent vertical rhythm. | [GOV.UK type scale](https://design-system.service.gov.uk/styles/type-scale/) | Use a small number of responsive type tokens rather than ad hoc sizes. Keep display type dramatic only where it does not compete with learning content. |
| The GOV.UK system separates functional colors by purpose and gives focus, error, success, link, and surface roles. | [GOV.UK colour](https://design-system.service.gov.uk/styles/colour/) | Define semantic tokens such as `primary`, `focus`, `info`, `warning`, `success`, and `destructive`; do not expose raw hue names as component logic. |
| Geist Sans is described by its publisher as a legible, simple modern sans; Geist Mono is designed as its code/text-interface partner. Both are distributed under the SIL Open Font License. | [Vercel Geist](https://vercel.com/font) and [the official Geist repository](https://github.com/vercel/geist-font) | Geist is a strong operational face for Morshid’s app, especially chat, forms, dashboards, and code-adjacent UI. |
| Fraunces is explicitly a display, old-style soft serif with optical-size, softness, weight, and “wonk” axes. | [The typeface’s official repository](https://github.com/undercasetype/Fraunces) | Fraunces gives Morshid personality and an academic/editorial signal, but should remain a display accent—not the default face for dense chat or forms. |
| Noto’s official documentation recommends script-specific families, recommends the UI variant for Arabic controls, and cautions that most sites need no more than three weights per family. | [Noto usage documentation](https://notofonts.github.io/noto-docs/website/use/) and [Noto Arabic](https://notofonts.github.io/arabic/) | Plan Arabic as a real script system, not as an accidental fallback. Load only the scripts and weights the product uses. |

## Recommended theme: “Guided Ink”

### Visual character

Morshid should feel like a calm, well-designed study desk with a reliable guide beside it:

- **Trust:** dark ink, strong text contrast, stable geometry, and restrained surfaces.
- **Learning:** warm paper, annotations, source markers, and an amber “important” cue.
- **Guidance:** teal appears on actions, links, progress, and course-grounded cues—not everywhere.
- **Human review:** use explicit labels and a distinct review icon/treatment; do not make “reviewed” depend on green alone.
- **Modernity:** variable typography, responsive scale, precise spacing, and subtle motion create polish without making the product look like a game or an AI demo template.

### Proposed semantic palette

These are proposed Morshid tokens, not colors copied from a source design system. The contrast figures below were calculated from the proposed sRGB hex values using the WCAG relative-luminance formula; they still need verification against rendered components and opacity layers.

| Semantic token | Light value | Dark value | Use |
| --- | --- | --- | --- |
| `background` | `#F8F7F2` | `#0F1B2D` | Page/canvas background |
| `surface` | `#FFFFFF` | `#14243A` | Chat panel, cards, dialogs, source panel |
| `surface-raised` | `#F1F3F0` | `#1B2E46` | Selected rows, raised controls, code surfaces |
| `foreground` | `#17202A` | `#F5F4ED` | Primary text and headings |
| `muted-foreground` | `#4A5968` | `#B9C4D1` | Secondary text; never use for essential content without checking the background |
| `primary` | `#006B63` | `#55D5C8` | Main action, active navigation, course-grounded cue |
| `primary-foreground` | `#FFFFFF` | `#0B1A1B` | Text/icon on primary actions |
| `info` | `#0B5FFF` | `#8DDCFF` | Citation/help/focus-adjacent information |
| `info-foreground` | `#FFFFFF` | `#0F1B2D` | Text/icon on info fills |
| `learning` | `#8B5E00` | `#FFD166` | Annotation, progress, “important” emphasis |
| `learning-foreground` | `#FFFFFF` | `#0F1B2D` | Text/icon on learning fills |
| `destructive` | `#C24135` | `#FF9B8E` | Errors, deletion, unsafe or blocked actions |
| `destructive-foreground` | `#FFFFFF` | `#0F1B2D` | Text/icon on destructive fills |
| `border-strong` | `#6F7F7B` | `#61758E` | Input/control borders and selected-state outlines |
| `focus` | `#0B5FFF` | `#8DDCFF` | Dedicated `:focus-visible` indicator |

Useful checked pairs:

- Light body text `#17202A` on `#F8F7F2`: **15.337:1**.
- Light muted text `#4A5968` on `#F8F7F2`: **6.705:1**.
- Light primary text `#006B63` on white: **6.396:1**.
- Dark body text `#F5F4ED` on `#0F1B2D`: **15.676:1**.
- Dark muted text `#B9C4D1` on `#0F1B2D`: **9.778:1**.
- Dark primary `#55D5C8` on `#0F1B2D`: **9.661:1**; dark primary foreground `#0B1A1B` on that teal: **9.966:1**.
- Proposed strong borders meet at least 3:1 against their intended light and dark surfaces; verify any translucent border variants separately.

Do not use these colors as a simple “red means error / green means success” legend. Every status should include a readable label and a non-color cue. Keep gradients away from body copy and citation text; if the landing hero uses a gradient, place it behind a solid or tested text surface.

## Recommended typography system

### Family roles

1. **Geist Sans Variable — operational voice**

   Use it for the app shell, sidebar, navigation, controls, chat messages, assistant markdown, forms, dashboards, and most landing-page supporting copy. Its neutral geometry keeps citations, hint levels, review states, and code diagnosis easy to scan.

2. **Fraunces Variable — Morshid’s editorial signature**

   Use it for the landing hero, the Morshid wordmark, major section titles, and rare narrative moments such as a short “guiding principle” quote. The official typeface documentation identifies it as a display face and exposes optical-size, softness, weight, and wonk axes; that is a reason to use it with restraint, not to make it the app’s reading face.

   Recommended starting point for display: weight 600–700, optical size 72–144 for the largest hero text, `WONK` 0 for a calmer normalized shape, and low-to-moderate `SOFT` values. Tune by specimen rather than applying the most expressive axis settings everywhere.

3. **Geist Mono Variable — technical voice**

   Use it for submitted code, code blocks, course codes, file names, citation identifiers, timestamps, and compact system metadata. Keep prose in Geist Sans; monospace should signal a technical artifact, not make the interface feel like a terminal.

4. **Noto Sans Arabic UI / Noto Sans Arabic — Arabic system**

   If Morshid ships Arabic UI or Arabic course content, use `Noto Sans Arabic UI` for controls and compact interface text, and evaluate `Noto Sans Arabic` for longer reading. The Arabic family must be selected intentionally with `lang="ar"` and `dir="rtl"`; do not rely on a Latin font’s fallback glyphs for the brand or UI.

### Type tokens

| Token | Size / line-height | Weight | Family | Intended use |
| --- | --- | --- | --- | --- |
| `display-xl` | `clamp(2.75rem, 7vw, 5.5rem)` / `1.0` | 600–700 | Fraunces | Landing hero only |
| `display-lg` | `clamp(2rem, 4vw, 3.5rem)` / `1.05` | 600 | Fraunces | Landing sections and auth brand moments |
| `heading-lg` | `1.75rem` / `1.2` | 650–700 | Geist Sans | Page-level headings |
| `heading-md` | `1.25rem` / `1.35` | 600 | Geist Sans | Card, panel, and conversation headings |
| `body-lg` | `1.125rem` / `1.55` | 400 | Geist Sans | Landing lead and important explanatory copy |
| `body` | `1rem` / `1.55–1.65` | 400 | Geist Sans | Chat, source excerpts, forms, dashboards |
| `label` | `0.8125rem` / `1.3` | 600 | Geist Sans | Buttons, labels, navigation, status names |
| `meta` | `0.75–0.8125rem` / `1.4` | 500–600 | Geist Sans or Geist Mono | Non-primary metadata; never hide important meaning here |
| `code` | `0.8125–0.875rem` / `1.55–1.65` | 400–500 | Geist Mono | Code, identifiers, and technical snippets |

Use relative units and let text grow. Avoid making meaningful student guidance smaller than the `body` token to fit more content. Keep assistant prose and source excerpts at roughly `max-width: 70ch`, left-aligned in LTR and right-aligned in RTL, with no justification. This is an implementation target derived from the W3C readability guidance, not a conformance claim by itself.

## Alternatives considered

| Option | Strength | Trade-off | Decision |
| --- | --- | --- | --- |
| **Guided Ink: Geist + Fraunces + Noto Arabic** | Best balance of current implementation, modern product clarity, editorial warmth, and Morshid’s “guide through material” identity | Requires discipline so Fraunces does not leak into dense app content; Arabic needs an additional family | **Recommended** |
| **Pure product neutral: Geist Sans + Geist Mono** | Lowest implementation cost, very coherent, crisp for chat and admin tooling | Less memorable and less emotionally distinctive for the landing page | Good fallback if the editorial accent feels too strong |
| **Academic modern: Source Sans 3 + Source Serif 4** | Adobe describes Source Sans as designed for UI environments; Source Serif is its companion and is designed for many sizes, weights, and languages ([Source Sans](https://github.com/adobe-fonts/source-sans), [Source Serif](https://github.com/adobe-fonts/source-serif)) | More institutional and document-like; changing the existing Latin stack adds cost without solving Arabic by itself | Strong alternative for a library/document-first product |
| **Multilingual-first: Noto Sans + Noto Serif + Noto Sans Arabic UI** | Broad script strategy and official guidance for script-specific web fonts | Less ownable as a Latin brand system; more font assets and more tuning across scripts | Use when Arabic or additional scripts become a launch requirement |

The key decision is not “serif versus sans.” It is **sans for sustained product work, serif for a controlled brand signal**. That separation protects readability while giving the landing experience enough character to be memorable.

## Implementation notes

### Theme and component application

- Keep semantic tokens (`background`, `surface`, `foreground`, `primary`, `info`, `learning`, `destructive`, `focus`) rather than naming components after hues.
- Use surface contrast and thin rules to create hierarchy. Reserve shadows for elevation and avoid glow effects around ordinary controls.
- Let the landing page carry the strongest visual expression: Fraunces hero type, one teal beacon accent, warm paper in light mode, and editorial rules. Keep the student chat quieter so the answer and citations remain the visual focus.
- Use a calm surface for assistant messages and a subtle primary-tinted treatment for student actions. Do not make every message a large floating bubble.
- Use teal for actions and grounded guidance, blue for information/focus, amber for learning emphasis, and coral for destructive/error states. Add labels and icons to all status treatments.
- Code blocks should have their own raised surface and adequate padding. Do not use color alone to distinguish inline code, citations, review state, or uncertainty.
- Make the focus ring independent of hover and brand colors. A two-pixel `:focus-visible` outline with a two-pixel offset is a suitable starting point; verify it against both `surface` and `surface-raised`.

### Font implementation

The Latin families are already bundled. The intended CSS roles are conceptually:

```css
--font-sans: 'Geist Variable', ui-sans-serif, system-ui, sans-serif;
--font-display: 'Fraunces Variable', Georgia, serif;
--font-mono: 'Geist Mono Variable', ui-monospace, monospace;
--font-arabic-ui: 'Noto Sans Arabic UI', 'Noto Sans', 'Geist Variable', sans-serif;
```

- Keep the existing local font imports and avoid adding a second Latin UI family unless the recommendation is deliberately changed.
- Load only the weights actually used. Three weights per family is a sensible starting budget, consistent with Noto’s official web-font guidance.
- Use `font-optical-sizing: auto` for variable families where appropriate. Apply Fraunces axis settings only to display styles; do not force `font-variation-settings` on all text.
- Keep rendered assistant markdown in Geist Sans, including headings that occur inside long answers. Fraunces can remain in landing/auth branding and short narrative treatments.
- If Arabic is added, ship and test the Arabic font as a first-class asset. Test mixed Arabic/Latin strings, numerals, punctuation, course names, citations, and RTL dialogs; also test the same type scale at the increased line-height Arabic may need.

### Accessibility and verification checklist

Before calling the theme finished:

- Audit every real foreground/background pair, including placeholder text, disabled-looking states that remain interactive, `opacity` utilities, code blocks, badges, and dark-mode surfaces. Use 4.5:1 for normal text and 3:1 for large text and meaningful control graphics as the minimum baseline.
- Verify control borders, selected states, icons, and focus indicators against their adjacent surfaces at 3:1 or better where they are needed to identify the control or state.
- Confirm that error, warning, reviewed, uncertain, and success states each have text/icon/shape cues in addition to color.
- Tab through landing, auth, student chat, citation panels, review dialogs, instructor tables, and settings. Focus must remain visible and must not be removed by component styling.
- Test `prefers-reduced-motion: reduce`; disable view-transition expansion, decorative reveals, and non-essential animated gradients while preserving state changes.
- Test browser zoom and text resize to 200%, plus the WCAG text-spacing override values. Check for clipped Fraunces headings, fixed-height buttons, truncated citations, and horizontally scrolling prose.
- Test mobile widths, especially the sidebar/chat/source-panel collapse, and ensure long course names, review reasons, filenames, and Arabic labels wrap without losing meaning.
- Test light, dark, system, and stored-theme behavior. Decide whether product default is dark or system before release and align the provider with the documented decision.
- Capture a grayscale screenshot pass. If a status, link, or action becomes ambiguous without hue, add a text or structural cue.

## Primary sources

Only first-party or standards-owner sources were used for the external research:

- [W3C Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [W3C: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [W3C: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
- [W3C: Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
- [W3C Technique C39: `prefers-reduced-motion`](https://www.w3.org/WAI/WCAG22/Techniques/css/C39)
- [W3C: Text Spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html)
- [W3C: Visual Presentation](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html)
- [W3C: Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)
- [GOV.UK Design System: Colour](https://design-system.service.gov.uk/styles/colour/)
- [GOV.UK Design System: Type scale](https://design-system.service.gov.uk/styles/type-scale/)
- [GOV.UK Design System: Paragraphs](https://design-system.service.gov.uk/styles/paragraphs/)
- [Vercel: Geist font](https://vercel.com/font)
- [Vercel’s official Geist repository](https://github.com/vercel/geist-font)
- [Undercase Type: Fraunces repository](https://github.com/undercasetype/Fraunces)
- [Noto official usage documentation](https://notofonts.github.io/noto-docs/website/use/)
- [Noto Arabic](https://notofonts.github.io/arabic/)
- [Adobe Fonts: Source Sans](https://github.com/adobe-fonts/source-sans)
- [Adobe Fonts: Source Serif](https://github.com/adobe-fonts/source-serif)
