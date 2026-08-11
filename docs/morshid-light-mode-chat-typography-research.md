# Morshid light mode and student-chat typography research

**Research date:** 2026-08-11
**Scope:** Light-mode theme direction and student-chat typography only
**Recommendation status:** Ready for design review; implementation intentionally not included

> Historical research note: the source paths below were captured before the
> workspace ownership refactor. They are evidence for visual decisions, not
> current module locations.

## Executive recommendation

Keep the current **Guided Ink** identity, but sharpen its light mode into a calm **Reading Desk**:

- Use a warm near-white canvas (`#F8F7F2`) rather than a full-page pure-white field.
- Use white assistant surfaces, a very light mineral-teal student surface, a cool neutral code surface, and a restrained blue citation surface.
- Keep body ink dark and neutral. Use mineral teal for actions and course-grounded guidance; blue for citations/focus; amber for learning emphasis; coral for errors.
- Treat those as semantic roles, not reusable hue names. A role should not silently change meaning from one component to another.
- Keep color out of the prose itself as much as possible. Labels, icons, borders, and surface treatment should carry state alongside color.

For the student chat, use this hierarchy:

| Role | Recommendation |
| --- | --- |
| Chat prose, student turns, assistant turns | Geist Sans Variable, `1rem`, `1.6` line-height, regular or slightly text-emphasized weight |
| Assistant headings inside a response | Geist Sans Variable, not Fraunces; `1.125–1.25rem`, `1.35` line-height, semibold |
| Chat labels and status text | Geist Sans Variable, `0.8125rem` minimum starting point; use weight and iconography for hierarchy |
| Citation number, source passage number, course/file identifiers | Geist Mono Variable, only for the identifier itself |
| Citation title and excerpt | Geist Sans Variable, `0.875–0.9375rem`, `1.55–1.65` line-height |
| Code | Geist Mono Variable, `0.8125–0.875rem`, `1.55–1.65` line-height, horizontal scrolling only inside the code surface |
| Math | MathJax or KaTeX’s math font system; do not force mathematical notation into Geist Mono |
| Arabic UI | Noto Sans Arabic UI |
| Arabic chat/course prose | Noto Sans Arabic; evaluate Noto Naskh Arabic for document-like long-form course reading |
| Brand/display moments outside chat | Fraunces Variable, restrained to landing/auth/marketing display type |

The most important comfort change is not a new typeface. It is removing the current chat-wide `text-sm`/12px bias for sustained reading. The repository currently gives message bubbles `text-sm leading-7`, while code, tables, and citation excerpts often use `text-xs`; these are reasonable compact-control sizes but should not be the default for a student reading a multi-turn explanation. This is a repository-fit observation and a product recommendation, not a WCAG claim.

## What the primary sources establish

| Finding | Source | Consequence for Morshid |
| --- | --- | --- |
| WCAG 2.2 requires at least `4.5:1` for normal text and `3:1` for large text; contrast is based on relative luminance rather than hue. The guidance also warns that thin or unusual fonts can appear fainter in practice. | [W3C WCAG 2.2, Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Test the actual foreground/background pair, including text rendered in a custom font. Do not make pale teal, amber, or coral the default body-text color. Aim comfortably above AA for chat prose. |
| Important control/state graphics need at least `3:1` against adjacent colors. | [W3C WCAG 2.2, Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) | Test input borders, selected rows, icons that communicate state, focus rings, and status marks—not only text. |
| Color cannot be the only visual means of communicating information or distinguishing a component. | [W3C WCAG 2.2, Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) | “Course grounded”, “awaiting review”, “error”, and “success” need a readable label, icon, shape, or structural cue in addition to their color. |
| Text must keep its content and functionality when users apply a line height of at least `1.5`, paragraph spacing of at least `2×` the font size, letter spacing of `0.12×`, and word spacing of `0.16×`. | [W3C WCAG 2.2, Text Spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) | Avoid fixed-height message bodies, clipped badges, and typography that depends on tight tracking. Validate chat and citation surfaces with these overrides. |
| WCAG’s visual-presentation guidance uses no more than 80 characters/glyphs per line, no full justification, at least 1.5 line spacing, and sufficient paragraph spacing as an advanced readability target. | [W3C WCAG 2.2, Visual Presentation](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html) | Give assistant prose a readable measure, normally around `60–72ch`; keep it left-aligned in LTR and right-aligned in RTL rather than justified. This is a quality target, not a claim that Morshid automatically conforms to AAA. |
| Text must resize to 200% without loss of content or functionality, and ordinary content must reflow to the equivalent of a 320 CSS-pixel viewport at 400% zoom. | [W3C WCAG 2.2, Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) and [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | Use `rem`/relative sizing, let bubbles grow vertically, and reserve horizontal scrolling for code, data tables, and other explicitly two-dimensional content. |
| A keyboard-operable interface needs a visible focus indicator; W3C documents `:focus-visible`, preserving a user-agent indicator, and a two-color indicator as sufficient techniques. | [W3C WCAG 2.2, Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html) | Give light mode an independent focus token. Do not let a pale border, muted teal, or theme transition erase focus on the composer, citation accordion, retry button, or feedback actions. |
| GOV.UK groups colors by functional purpose so interactions remain predictable, and advises using roles/context rather than copying raw hex values into component logic. | [GOV.UK Design System: Colour](https://design-system.service.gov.uk/styles/colour/) | Keep Morshid tokens semantic: `--chat-student-surface`, `--info`, `--warning`, `--destructive`, `--focus`, and so on. The proposed values below are Morshid design inferences, not GOV.UK palette values. |
| GOV.UK’s type scale uses relative units for better resizing, aligns styles to a consistent vertical rhythm, and changes the scale for screen size. Its current body guidance uses 19px as the default paragraph size and 16px only as a smaller body style. | [GOV.UK Design System: Type scale](https://design-system.service.gov.uk/styles/type-scale/) and [Paragraphs](https://design-system.service.gov.uk/styles/paragraphs/) | A 16px chat baseline is a conservative product minimum, not a magic accessibility threshold. Do not shrink sustained student/assistant prose to 12–14px merely to fit more history on screen. |
| Apple’s platform typography guidance says to use legible sizes, minimize the number of typefaces, give long/wide passages looser leading, and make custom fonts support user text scaling. | [Apple Human Interface Guidelines: Typography](https://developer.apple.com/design/human-interface-guidelines/typography) | Keep the chat family count low, reserve Fraunces for display, and give prose enough leading to track across multiple lines. The platform guidance is used here as a design reference; Morshid remains a web product. |
| Vercel describes Geist Sans as a sans-serif designed for legibility and simplicity, and Geist Mono as its partner for code editors, diagrams, terminals, and other code/text interfaces. | [Vercel Geist font repository](https://github.com/vercel/geist-font) | The current Geist + Geist Mono choice fits the product. Use the sans for reading and the mono for technical artifacts instead of turning every metadata label into a terminal-like treatment. |
| Fraunces is explicitly a display soft-serif with optical-size, weight, softness, and wonk axes. Its own documentation says that its peculiar display characteristics are less desirable for continuous reading and describes what happens at small optical sizes. | [Fraunces official repository](https://github.com/undercasetype/Fraunces) | Keep Fraunces out of dense assistant answers, citation excerpts, and form controls. Its role is Morshid’s memorable editorial signal, not the chat reading face. |
| Noto’s web guidance recommends script-specific families, distinguishes UI variants from document variants, and says Arabic continuous reading needs more generous line height; it recommends Noto Sans Arabic UI for compact UI and non-UI Arabic fonts for documents. | [Noto: Use Noto fonts on the web](https://notofonts.github.io/noto-docs/website/use/) | Add a real Arabic font asset before Arabic launch. Use Noto Sans Arabic UI for controls and Noto Sans Arabic for mixed Arabic/English chat prose; test Naskh separately if the product adds long Arabic course passages. |
| W3C Internationalization recommends declaring `lang`, marking the base direction with `dir`, tightly wrapping opposite-direction inline phrases, and using `dir=auto`/`bdi` when the direction is unknown at runtime. | [W3C: Declaring language in HTML](https://www.w3.org/International/questions/qa-html-language-declarations) and [W3C: Inline markup and bidirectional text in HTML](https://www.w3.org/International/articles/inline-bidi-markup/index.en.html) | Mixed Arabic/English response content, course titles, filenames, citations, and code snippets need directional metadata, not only a CSS `font-family` fallback. |
| CSS Fonts Level 4 defines `font-optical-sizing: auto` and recommends higher-level properties such as `font-weight` and `font-optical-sizing` rather than using low-level variation settings for axes they already control. | [W3C CSS Fonts Module Level 4](https://www.w3.org/TR/css-fonts-4/) | Let Geist/Fraunces use optical sizing where appropriate. Apply Fraunces’s expressive axes only to display styles; do not inherit display variation settings into chat prose. |
| MathJax uses dedicated math font sets and supports alternatives such as STIX2; it also documents fallback behavior when a font lacks a glyph. KaTeX similarly ships dedicated math fonts and sizes math relative to surrounding text. | [MathJax 4 font support](https://docs.mathjax.org/en/latest/output/fonts.html) and [KaTeX font documentation](https://katex.org/docs/font) | Treat math as a separate typesetting system. The chat’s UI font should surround a math renderer, not be asked to supply stretchy operators, radicals, integrals, or all mathematical glyphs. |
| In one original screen-reading study, a medium line length of about 55 characters supported effective reading in the tested task; a separate original study found a positive-polarity advantage for legibility under dark ambient conditions. These are context-dependent experiments, not universal web rules. | [Dyson & Haselgrove, 2001, DOI 10.1006/ijhc.2001.0458](https://doi.org/10.1006/ijhc.2001.0458) and [Dobres et al., 2017, PubMed 28166901](https://pubmed.ncbi.nlm.nih.gov/28166901/) | Start assistant prose around 55–72 characters where the layout allows, keep a genuinely usable light mode, and verify with Morshid’s real answer lengths and student behavior rather than treating one number or polarity as absolute. |

## Fit check against the current repository

### What already fits

- [`client/src/styles.css`](../client/src/styles.css) already has a warm light canvas, dark ink, white cards, mineral teal primary, blue information color, amber learning color, coral destructive color, and semantic CSS variables. That is the right foundation for the Reading Desk direction.
- The client already imports `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`, and `@fontsource-variable/fraunces` in [`client/src/styles.css`](../client/src/styles.css). No new Latin family is needed for this recommendation.
- Fraunces is already separated into display utilities, and assistant markdown headings use sans styling in the student tutor workspace. That separation should remain.
- Assistant turns already use a calm card surface and student turns already use a distinct tinted surface in the student tutor workspace. That is preferable to adding more color or a different font to every role.

### Gaps to resolve in a later implementation pass

- `StudentChatMessage` gives the whole bubble `text-sm leading-7`. For long-form study, change the semantic chat body token to approximately 16px/1.6 rather than relying on a very large line-height with 14px text.
- `StudentAssistantMarkdown` uses 12px tables and 12px code blocks, and `StudentCitationSources` uses 12px excerpts. Keep compact tables when necessary, but make readable source excerpts and normal code examples closer to the typography spec below.
- `StudentCitationSources` currently applies `font-mono` to the whole citation badge, including the material title. Keep only `[1]`/identifiers in Geist Mono; render human-readable course/material titles in Geist Sans.
- `StudentChatContent` uses `font-mono text-xs leading-5` for code. The role is correct; the size/leading should be tested at 13–14px and roughly 1.6 for code diagnosis sessions.
- The CSS declares `Noto Sans Arabic UI` and `Noto Sans Arabic` as names in a fallback stack, but [`client/package.json`](../client/package.json) does not currently include an Arabic font package. A fallback name is not a shipped font. Confirm actual font loading and glyph coverage before promising Arabic UI or Arabic course chat.
- The current client has no MathJax or KaTeX dependency. If equations become part of course-grounded answers, add a deliberate math rendering decision rather than styling raw TeX with Geist Mono.
- The current theme system supports light, dark, and system modes. The app provider currently chooses dark as its default. Keep the light mode fully tested even if dark remains the product default; students may explicitly select light mode or use a stored preference.

## Recommended light-mode direction: “Reading Desk”

### Design intent

This is a design inference from the product context and the accessibility constraints above:

- **Calm:** make the page canvas warm and nearly white, with only small, controlled color fields around interaction or evidence.
- **Trustworthy:** use dark neutral ink for prose and headings; avoid colored body copy and low-contrast gray-on-tint combinations.
- **Course-grounded:** let citations and grounded guidance have a cool blue/teal cue, but keep the cited text itself neutral and readable.
- **Student-first:** distinguish student and assistant turns through surface, alignment, avatar, and header structure; do not make the student’s own text smaller or more decorative.
- **Memorable but suitable:** use mineral teal as the brand beacon and keep Fraunces for display moments outside the working chat. The chat should feel like a modern study tool, not a marketing poster.
- **Low visual noise:** no glassy translucency, colored glow behind prose, gradients beneath citations, or saturated full-bleed message bubbles.

The positive-polarity research cited above supports keeping light mode as a first-class, well-tuned reading environment, but it does not prove that all users prefer light mode. Light and dark must remain user-selectable; the design should not infer ability or preference from the theme.

### Proposed light semantic tokens

The values below are Morshid recommendations, not values copied from GOV.UK, Apple, or another design system. They are expressed as hex targets so their contrast can be audited. If implementation stores them as OKLCH, verify the browser-computed sRGB result and every opacity/compositing variant.

| Token | Value | Role in light mode | Do not use it for |
| --- | --- | --- | --- |
| `background` / `canvas` | `#F8F7F2` | Warm near-white page canvas and long-session background | Primary text surface when a white assistant card is the clearer layer |
| `surface` / `assistant` | `#FFFFFF` | Assistant message cards, dialogs, source cards, composer | The entire app canvas |
| `surface-subtle` | `#F0F4F1` | Secondary controls, quiet selected rows, neutral code context | Essential text without a tested foreground |
| `surface-student` | `#E8F4F2` | Student message background and student-authored context | Status meaning by itself |
| `surface-code` | `#EEF1F3` | Code blocks and technical artifacts | Ordinary prose paragraphs |
| `surface-citation` | `#ECF3FF` | Citation markers, source grouping, evidence context | Large saturated panels behind long excerpts |
| `foreground` / `ink` | `#17202A` | Prose, headings, code text, high-priority labels | — |
| `muted-foreground` | `#4A5968` | Secondary labels, timestamps, supporting text | The only representation of a required status |
| `primary` / `teal` | `#006B63` | Primary actions, links where appropriate, grounded guidance cue | Every interactive element |
| `primary-hover` | `#00564F` | Hover/active darkening for teal controls | Body text on pale teal without testing |
| `info` / `focus` | `#0B5FFF` | Links, citation affordances, focus ring, information state | A color-only success/error legend |
| `info-on-citation` | `#0B4F9C` | Information text on the pale citation surface | Text on arbitrary surfaces without checking |
| `learning` / `warning` | `#8B5E00` | Learning emphasis, review pending, “important” annotation | Tiny low-contrast metadata |
| `destructive` | `#C24135` | Errors, unsafe/blocked action, destructive action | Decorative accent or normal body copy |
| `border-strong` | `#66746F` | Input boundaries, selected state, control outlines | A replacement for a focus indicator |
| `border-subtle` | `#D5DDD9` | Decorative dividers and low-meaning grouping rules | The only way to identify an interactive control |
| `on-primary` | `#FFFFFF` | Text and icons on `primary` | Text on arbitrary tinted surfaces |

### Contrast spot-checks

These ratios were calculated from the hex targets using the relative-luminance and contrast-ratio formula defined by [W3C WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). They are design-token checks, not a substitute for rendered-component testing.

| Pair | Calculated ratio | Intended reading |
| --- | ---: | --- |
| `#17202A` on `#F8F7F2` | `15.34:1` | Primary canvas prose |
| `#4A5968` on `#F8F7F2` | `6.70:1` | Secondary canvas text |
| `#006B63` on `#FFFFFF` | `6.40:1` | Teal action/link text |
| `#0B5FFF` on `#FFFFFF` | `5.13:1` | Information/focus text |
| `#8B5E00` on `#FFFFFF` | `5.68:1` | Warning/learning text |
| `#C24135` on `#FFFFFF` | `5.12:1` | Destructive/error text |
| `#66746F` on `#FFFFFF` | `4.89:1` | Strong control border |
| `#17202A` on `#E8F4F2` | `14.61:1` | Student message prose |
| `#17202A` on `#EEF1F3` | `14.50:1` | Code text surface |
| `#0B4F9C` on `#ECF3FF` | `7.21:1` | Citation text on citation tint |

`border-subtle` is intentionally not presented as a 3:1 control-boundary token: `#D5DDD9` on white calculates to only about `1.38:1`. Use it for non-essential grouping or pair it with another visible state cue. Any `bg-primary/5`, `border-info/25`, or similar alpha utility must be checked after compositing; the raw solid-token ratio does not prove the translucent variant passes.

### Light-mode component rules

| Component | Light-mode treatment | Accessibility guardrail |
| --- | --- | --- |
| Page canvas | `background`; warm and quiet | Keep body ink high contrast; do not put essential copy over decoration |
| Assistant message | White `surface`, neutral ink, a quiet border | The answer remains the strongest visual object; label the assistant in text |
| Student message | `surface-student`, same chat-body type as assistant | Do not rely on teal tint alone to identify the speaker; retain avatar/alignment/accessible label |
| Composer | White or `surface`, strong input border, teal submit action | Test placeholder, focus ring, disabled, sending, and error states independently |
| Citation marker | `surface-citation` with `info-on-citation`; number/identifier in mono, title in sans | Keep `[1]` and “Sources” readable without color; use the accordion/heading relationship |
| Source excerpt | Neutral text on white or a very light source card | Do not make evidence 12px by default; preserve line length and paragraph spacing |
| Code block | `surface-code`, Geist Mono, scrollable only inside the block | Add language label; keep code text readable and keyboard-scrollable |
| Review/warning state | Amber or coral border/surface cue plus icon and label | Color is supplementary; keep the review status text visible |
| Focus | Dedicated blue focus token with a contrasting keyline/offset | Focus must remain visible on white, pale teal, citation, and code surfaces |

## Student-chat typography specification

### Family roles

#### Geist Sans Variable: the working voice

Use Geist Sans for:

- student and assistant prose,
- headings inside assistant markdown,
- composer text and placeholder,
- citation titles and excerpts,
- status labels and review messages,
- navigation and controls.

Vercel’s own description positions Geist Sans around legibility and simplicity, while the current repository already ships it locally. This is the lowest-risk, most coherent choice for Morshid’s working interface. It is still a design recommendation, not proof that Geist is objectively more readable than every alternative.

#### Geist Mono Variable: the technical voice

Use Geist Mono for:

- code blocks and inline code,
- file names, package names, course codes, and technical identifiers,
- citation numbers or source-passage identifiers when a compact technical cue is useful,
- machine-like diagnostic labels.

Do not use it for the full material title, a source excerpt, a review explanation, or normal answer prose. Monospace should answer “this is an artifact or identifier,” not “this text is less important.”

#### Fraunces Variable: the editorial signature, outside the chat

Use Fraunces for landing/auth display type and occasional short brand statements. Do not use it as the default chat font or for long source excerpts. Its own documentation calls it a display face and says its more peculiar display characteristics are less desirable for continuous reading; that directly supports keeping it out of the student’s working transcript.

#### Noto Sans Arabic / Noto Sans Arabic UI: first-class Arabic support

The current CSS fallback names are a useful intent, but they do not ship glyphs. Recommended roles:

- `Noto Sans Arabic UI` for buttons, tabs, compact labels, status chips, and dense controls.
- `Noto Sans Arabic` for student and assistant chat prose where a sans treatment should stay visually close to Geist Sans.
- `Noto Naskh Arabic` as an evaluated alternative for long, document-like Arabic course text; do not mix it into short UI labels without a specimen review.

Noto’s guidance explains that Arabic UI families are more compact vertically, while non-UI variants suit documents and continuous reading. Set a larger Arabic line-height than Latin and test Arabic punctuation, numerals, and Latin technical terms in the same answer.

### Proposed type tokens

These are implementation targets for design review. They intentionally use relative units and leave enough room for user scaling.

| Token | Size | Line-height | Weight | Family | Use |
| --- | ---: | ---: | ---: | --- | --- |
| `chat-body` | `1rem` | `1.6` (`25.6px` at default root) | `400–450` | Geist Sans | All ordinary student and assistant prose |
| `chat-body-ar` | `1rem` | `1.75–1.85` | `400–500` | Noto Sans Arabic | Arabic and mixed Arabic/English prose |
| `chat-heading` | `1.125–1.25rem` | `1.35` | `600` | Geist Sans | Markdown headings within a response |
| `chat-heading-ar` | `1.125–1.25rem` | `1.45–1.55` | `600` | Noto Sans Arabic | Arabic response headings |
| `chat-label` | `0.8125rem` | `1.35` | `600` | Geist Sans / Arabic UI | AI Tutor, speaker, status, action labels |
| `chat-meta` | `0.75–0.8125rem` | `1.4` | `500–600` | Geist Sans | Timestamps, supporting metadata, non-essential helper text |
| `citation-marker` | `0.75–0.8125rem` | `1.4` | `500` | Geist Mono | `[1]`, source passage number, compact identifier |
| `citation-title` | `0.875–0.9375rem` | `1.55` | `500–600` | Geist Sans | Material title and source name |
| `citation-excerpt` | `0.875–0.9375rem` | `1.55–1.65` | `400` | Geist Sans | Evidence excerpt shown beneath a source |
| `code` | `0.8125–0.875rem` | `1.55–1.65` | `400–500` | Geist Mono | Code diagnosis and fenced code |
| `inline-code` | `0.9em` of surrounding text | inherit / at least `1.5` | `450–500` | Geist Mono | Short identifiers inside prose |
| `math-inline` | `1em` | `1.4–1.5` | renderer-controlled | MathJax/KaTeX | Inline formulae and symbols |
| `display-support` | `1rem` | `1.45–1.6` | `400` | Geist Sans | Explanatory text around display math |

### Comfortable chat rules

1. **Same reading scale for both speakers.** Student messages and assistant answers should use the same `chat-body` token. Speaker distinction comes from alignment, avatar, surface, header, and accessible labeling—not a tiny student font or an oversized assistant font.

2. **One reading measure.** Keep ordinary assistant prose around `60–72ch` when the layout allows. This respects the WCAG 80-character advanced target while leaving room to test the shorter line-length finding from Dyson and Haselgrove. Do not force the measure on code, tables, or a user-authored line that must remain intact.

3. **No justification.** Use normal left alignment for LTR and normal right alignment for RTL. Full justification creates uneven word spacing and is explicitly discouraged in the WCAG visual-presentation guidance.

4. **Paragraph rhythm over extra weight.** Use paragraph spacing and heading spacing to separate ideas. Use semibold for headings and labels, but avoid making every sentence bold. The text-spacing override test must not clip or merge paragraphs.

5. **Keep body text stable on mobile.** At narrow widths, let the bubble become taller. Do not reduce chat prose below `1rem` as a response to a 390px viewport. Reduce display headings and non-essential metadata first.

6. **Make metadata quiet, not microscopic.** `12–13px` is appropriate for timestamps, state labels, and source-passage IDs when the content is supplementary. It is not appropriate for the main evidence excerpt or the answer that the student must learn from.

7. **Use mono selectively.** Keep the number, identifier, and code visually distinct; keep human language in the proportional sans. This makes citations and technical artifacts scannable without making the entire response feel like a terminal.

8. **Use relative sizing and test growth.** Use `rem`, `em`, and content-driven heights. Test 200% text resize and the WCAG text-spacing values before tightening gaps or setting `overflow: hidden`.

9. **Avoid expressive display axes in the transcript.** Fraunces’s `SOFT`/`WONK` personality belongs in the brand layer. Chat prose should keep optical sizing automatic and avoid inherited display `font-variation-settings`.

## Arabic + English mixed text

### Content model

For every response or message, retain language and direction metadata as close to the content as possible:

- Use `lang="ar"` for Arabic runs and `lang="en"` for English runs when the language is known.
- Use `dir="rtl"` on an Arabic message/block and `dir="ltr"` on an English message/block.
- Use `dir="auto"` or `bdi` for dynamic titles, filenames, usernames, and citation labels when the first-strong direction is not known in advance.
- Tightly wrap opposite-direction inline phrases. An Arabic sentence containing `React`, `CSS`, `HTTP 404`, `main.ts`, or `[1]` should not rely on a whole-message `dir` alone.
- Give code blocks `dir="ltr"` unless the code itself is a genuinely RTL language/content artifact. A code block’s direction should not be inferred from the surrounding Arabic prose.
- Keep punctuation and citation numbers inside the correct inline boundary. Test parentheses, slashes, colons, hyphens, and brackets around mixed scripts.

This follows W3C Internationalization’s markup guidance and the Unicode Bidirectional Algorithm rather than trying to repair bidi ordering with invisible characters in application strings. Use markup where markup is available; reserve control characters for contexts where markup is impossible.

### Arabic spacing and coverage

- Do not apply Latin-style aggressive tracking to Arabic UI or prose. This is a product typography inference from Arabic joining behavior; validate with real Arabic specimens.
- Start Arabic prose at `1rem / 1.75–1.85`; reduce only after testing paragraphs, inline code, numerals, and line wrapping. Noto’s documentation explicitly notes that Arabic continuous reading needs more generous line height.
- Keep Arabic UI labels shorter and use the UI variant where vertical space is constrained. Do not use the UI variant as an untested substitute for all long-form Arabic course content.
- Test Latin technical strings inside Arabic sentences, such as: `اشرح React hooks في ملف main.ts باستخدام HTTP 404 [1]`.
- Test Arabic numerals and Latin numerals, decimal points, mathematical operators, inline code, filenames, and citation markers together.
- Test fallback behavior with the network font disabled. Arabic should remain legible and should not unexpectedly inherit Fraunces, Geist Mono, or an unrelated serif fallback.

## Code, math, citations, and technical content

### Code

Code is a different reading task from prose:

- Use Geist Mono for code and keep it around `13–14px` with `1.55–1.65` line-height.
- Use a raised neutral code surface, not a saturated dark rectangle in light mode.
- Allow horizontal scroll inside the code block for long lines; do not let the entire chat page acquire horizontal scroll because of code.
- Keep a visible language label and a keyboard-focusable code region; the label should be human-readable sans text even though the code is mono.
- Do not set code to 12px solely to avoid scrolling. Let the block scroll or wrap deliberately, depending on whether preserving exact code columns matters.
- Make inline code slightly smaller than surrounding prose, not dramatically smaller. Preserve readable punctuation and mixed-script fallback.

### Math

Morshid currently has no MathJax or KaTeX dependency, so this is a future capability decision:

- Use a math renderer for fractions, radicals, integrals, matrices, stretchy delimiters, and aligned equations.
- Let MathJax/KaTeX supply the math font and metrics; do not style raw formula text as ordinary Geist Mono.
- Keep explanatory prose around equations in Geist Sans.
- Match math color to `foreground`, not to the info/teal color unless color is intentionally an annotation with a text alternative.
- Test inline and display math in both LTR and RTL blocks, including Arabic explanatory text around an LTR equation.
- Test long display equations at mobile widths. If a two-dimensional equation cannot reflow, contain the overflow in the equation surface and keep the surrounding transcript vertically scrollable.

### Citations and metadata

Use a two-layer citation treatment:

| Content | Font | Rationale |
| --- | --- | --- |
| `[1]`, `#3`, `Source passage 4`, course code | Geist Mono | Compact, scannable identifier |
| Material title | Geist Sans | Human-readable content should not look like machine output |
| Evidence excerpt | Geist Sans | Sustained reading and better mixed-script fallback |
| “Available”, “Unavailable”, “Awaiting review” | Geist Sans plus icon/label | State must remain understandable without color |
| Timestamp or response metadata | Geist Sans, optionally tabular numerals | Secondary information; do not make it compete with the answer |

This is an inference from Morshid’s current component structure and the role distinction documented by Geist’s publisher. It is not a claim that mono is inherently less readable.

## Font loading, fallback, and coverage notes

### Current state

The local client currently ships:

- Geist Sans Variable,
- Geist Mono Variable,
- Fraunces Variable.

The installed Geist packages expose Latin/Latin Extended, Cyrillic, Vietnamese, symbols, and related subsets; they do not provide an Arabic subset. The current CSS’s Noto names therefore behave as fallback names unless an Arabic font is added to the application. Verify the actual installed font files and `document.fonts` behavior in the browser rather than relying on the CSS stack’s appearance.

### Recommended loading strategy

- Keep the three existing Latin families; do not add another Latin UI face for chat.
- Add Arabic only when the product has a confirmed Arabic content/UI requirement, and subset the shipped font files to the languages/weights actually used.
- Load regular and semibold first. Add bold/italic only where the response renderer and product content need them.
- Ensure `font-display` behavior does not make the first response reflow so dramatically that the student loses reading position. Test the fallback and loaded states.
- Prefer CSS `font-weight` and `font-optical-sizing` for supported axes. Use `font-variation-settings` only for special Fraunces display behavior or another axis without a higher-level CSS property.
- Validate glyph coverage for Arabic presentation forms, Arabic-Indic digits if used, punctuation, Latin technical identifiers, mathematical symbols, and the course materials’ actual language mix.

### Fallback stack proposal

Conceptually, the roles should resolve like this; this is a specification, not an instruction to edit code in this research task:

```css
--font-chat-latin: 'Geist Variable', ui-sans-serif, system-ui, sans-serif;
--font-chat-arabic: 'Noto Sans Arabic', 'Geist Variable', ui-sans-serif, sans-serif;
--font-ui-arabic: 'Noto Sans Arabic UI', 'Noto Sans Arabic', sans-serif;
--font-code: 'Geist Mono Variable', ui-monospace, 'SFMono-Regular', Consolas, monospace;
--font-display: 'Fraunces Variable', Georgia, serif;
```

If Arabic is not shipped yet, the fallback should be honest in the product decision: Arabic is “system fallback tested” rather than “Noto-supported.” Do not promise matching Arabic/Latin metrics until real specimens have been rendered.

## Alternatives and trade-offs

| Direction | Strength | Trade-off | Decision |
| --- | --- | --- | --- |
| **Guided Ink / Reading Desk: Geist Sans + Geist Mono + Noto Arabic** | Lowest migration cost, matches the current implementation, modern without looking generic, gives the landing page a controlled editorial voice | Requires a real Arabic asset and disciplined separation between chat and display type | **Recommended** |
| Geist Sans + Geist Mono only | Smallest font surface and cleanest operational UI | Arabic remains a fallback problem; landing/brand expression is less distinctive | Good operational fallback, not the full Morshid identity |
| Geist Sans + Fraunces throughout chat | Stronger editorial personality | Fraunces is a display face and its own documentation cautions against its display characteristics for continuous reading | Reject for student chat |
| Noto Sans/Noto Arabic for the whole product | Broad script strategy and consistent fallback behavior | Less ownable in Latin UI; additional asset weight; may feel more document system than product | Use when multilingual coverage becomes the primary requirement |
| Source Sans/Source Serif or another new Latin family | Could create a more traditional reading identity | Adds migration and tuning cost without solving Arabic or technical math by itself | Keep as a future comparison, not a current change |

## Verification plan before implementation is considered complete

### Light mode

- Audit every real foreground/background pair after opacity compositing: canvas, assistant surface, student tint, code surface, citation tint, composer, badges, review states, hover, disabled-looking controls, placeholder text, and focus.
- Check normal text at `4.5:1` minimum, large text at `3:1`, and meaningful control/state graphics at `3:1` minimum. Aim higher for long-form chat.
- Run a color-removal/grayscale pass. Every status should still have a label, icon, or structural distinction.
- Keyboard through the chat composer, send/retry, citation accordion, source rows, copy, feedback, review request, and theme control. Focus must remain visible and must not be time-limited.
- Test light mode with both `prefers-reduced-motion: reduce` and ordinary motion. Theme transitions must not make the transcript unreadable during the change.

### Chat typography

- Render a long assistant answer with paragraphs, nested lists, headings, blockquote, inline code, fenced code, a table, citations, review status, and an error state in one transcript.
- Compare `14px/28px` versus `16px/25.6px` prose using real student answers; prefer the one that is easier to scan, not the one that produces the shortest transcript.
- Test target measures around 55, 65, and 72 characters per line. Verify the answer still feels comfortable in the actual 44rem message constraint and on mobile.
- Resize text to 200% and apply the WCAG text-spacing values. Look for clipped bubbles, collapsed headings, overflowing badges, and lost source titles.
- Test the equivalent of a 320px viewport at high zoom. Ordinary prose should reflow; only intentional code/table/equation surfaces may scroll in two dimensions.
- Turn off web-font loading and test fallback metrics. Then test with Arabic font loading enabled.
- Test mixed-language specimens in both directions:
  - `اشرح React hooks في ملف main.ts باستخدام HTTP 404 [1]`
  - `Use the Arabic term “التوجيه” in a React component named Router`
  - `احسب $f(x)=x^2+1$ ثم قارنها مع \`f.ts\``
- Validate screen-reader language changes and the programmatic relationship between message speaker, answer, citations, and review state.

## Source index

Only standards-owner, official documentation, official font repositories, official platform guidance, and original research were used for external claims in this note.

- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [W3C Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [W3C Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
- [W3C Text Spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html)
- [W3C Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)
- [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [W3C Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
- [GOV.UK Design System: Colour](https://design-system.service.gov.uk/styles/colour/)
- [GOV.UK Design System: Type scale](https://design-system.service.gov.uk/styles/type-scale/)
- [GOV.UK Design System: Paragraphs](https://design-system.service.gov.uk/styles/paragraphs/)
- [Apple Human Interface Guidelines: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Apple Human Interface Guidelines: Color](https://developer.apple.com/design/human-interface-guidelines/color)
- [Vercel Geist font repository](https://github.com/vercel/geist-font)
- [Fraunces official repository](https://github.com/undercasetype/Fraunces)
- [Noto: Use Noto fonts on the web](https://notofonts.github.io/noto-docs/website/use/)
- [W3C CSS Fonts Module Level 4](https://www.w3.org/TR/css-fonts-4/)
- [W3C: Declaring language in HTML](https://www.w3.org/International/questions/qa-html-language-declarations)
- [W3C: Inline markup and bidirectional text in HTML](https://www.w3.org/International/articles/inline-bidi-markup/index.en.html)
- [Unicode Standard Annex #9: Bidirectional Algorithm](https://www.unicode.org/reports/tr9/)
- [MathJax 4 font support](https://docs.mathjax.org/en/latest/output/fonts.html)
- [KaTeX font documentation](https://katex.org/docs/font)
- [Dyson & Haselgrove, 2001, “The influence of reading speed and line length on the effectiveness of reading from screen”](https://doi.org/10.1006/ijhc.2001.0458)
- [Dobres, Chahine, & Reimer, 2017, “Effects of ambient illumination, contrast polarity, and letter size on text legibility under glance-like reading”](https://pubmed.ncbi.nlm.nih.gov/28166901/)
