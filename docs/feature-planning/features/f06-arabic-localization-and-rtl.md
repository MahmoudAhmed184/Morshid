# F06: Arabic localization and RTL

**Difficulty:** Very hard  
**Dependencies:** F01

## Outcome

Ship complete English and Egyptian Arabic UI localization with correct initial
rendering, right-to-left layout, and mixed-direction content.

## Contract

- Add typed English and Arabic message catalogs covering public pages, all role
  workspaces, dialogs, validation, errors, empty states, metadata, and
  accessibility labels. English is the fallback for a missing development key;
  tests fail when the catalogs diverge.
- Store the authenticated language on the server and mirror it to a locale
  cookie so the server chooses the same locale before hydration. Use
  `Accept-Language` only for a first unauthenticated visit.
- Set document `lang` and `dir` before paint. Keep route slugs stable in English.
- Use semantic direction and CSS logical properties. Use `dir="auto"` for
  Student-authored content and inputs, and isolate emails, URLs, IDs, Course
  codes, filenames, citations, and model names.
- Format dates and numbers with `Intl` for `en` and `ar-EG`. Do not translate
  Course Materials, user content, or model output.
- The language setting changes UI language only; tutoring language continues to
  follow the Student's message and existing pedagogy.

## Acceptance criteria

- [ ] Every supported route works in both languages with no hard-coded visible
      application strings left outside the catalog.
- [ ] Hard refresh and sign-in have no wrong-language or wrong-direction flash.
- [ ] Sidebars, tables, dialogs, charts, forms, icons, and focus order behave in
      RTL without mirroring direction-neutral marks.
- [ ] Mixed Arabic and Latin chat, citations, timestamps, and identifiers render
      in the correct reading order.
- [ ] Acceptance tests cover public, Student, Instructor, and Admin journeys in
      Arabic at desktop and mobile widths.

## Out of scope

Localized URLs, automatic translation of content, additional languages, and
speech input or output.

