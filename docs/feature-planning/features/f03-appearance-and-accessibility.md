# F03: Appearance and accessibility

**Difficulty:** Easy  
**Dependencies:** F01

## Outcome

Extend the existing device-local theme settings with readable, low-motion, and
compact presentation choices.

## Contract

- Keep Light, Dark, System, and the existing six palettes.
- Add text scale values of 90%, 100%, and 112%.
- Add Comfortable and Compact density. Compact mode may reduce whitespace but
  keeps interactive targets at least 44 by 44 CSS pixels.
- Add Follow system and Reduce motion. The product never overrides an operating
  system request to reduce motion.
- Add one reset action for this device's appearance and accessibility values.
- Namespace stored preferences by authenticated user. Apply a stable default
  before hydration and avoid flashes between modes.
- Use root data attributes and tokens so features consume one presentation
  state instead of reading local storage independently.

## Acceptance criteria

- [ ] Every choice applies immediately, persists on the device, and survives a
      hard refresh without a hydration warning.
- [ ] Reset restores Morshid, Light/System as currently established, 100% text,
      Comfortable density, and Follow system motion.
- [ ] Text remains readable and controls remain usable at 200% text resize and
      320 CSS-pixel reflow.
- [ ] Theme transitions and other interaction animation stop in reduced mode.
- [ ] Automated tests cover invalid stored values, multiple users on one
      browser, system preference changes, reset, and SSR fallback behavior.

## Out of scope

New palettes, custom colors, arbitrary font sizes, font-family selection, and
server synchronization of device presentation preferences.

