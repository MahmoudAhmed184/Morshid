# Primary-source constraints for the feature program

Research date: 2026-08-15. This note records only findings that change the implementation briefs. All external references are first-party documentation or standards.

## Antigravity and Gemini 3.7 Flash High

Google documents workspace rules as Markdown files in `.agents/rules`. Rules may be always on, manually activated, selected by the model, or matched by a glob. They can reference repository files with `@path`, and each rule has a 12,000-character limit. Workflows are saved Markdown prompts with a title, description, and steps, invoked as `/workflow-name`, with the same size limit. The current documentation explains creating workflows through Antigravity's Customizations UI but does not publish a stable on-disk workspace path. [Antigravity rules and workflows](https://antigravity.google/docs/rules-workflows)

Antigravity also reads root `GEMINI.md` or `AGENTS.md` files for repository-wide standards. [Antigravity CLI best practices](https://antigravity.google/docs/cli/best-practices)

Gemini 3.7 Flash is GA as `gemini-3.7-flash`. It has a 1M-token input window, a 64k-token maximum output, and `low`, `medium`, and `high` thinking levels. Google describes High as the mode for the hardest coding, reasoning, and tool-use tasks, with higher latency and token use. [Gemini 3.7 Flash](https://ai.google.dev/gemini-api/docs/latest-model) Antigravity lists Gemini 3.7 Flash as available, but its current selector example shows Medium. [Antigravity models](https://antigravity.google/docs/models)

Planning consequence: keep each feature brief as ordinary repository Markdown, then use one short prompt file that `@`-references the selected brief and `AGENTS.md`. Do not duplicate briefs inside a rule. Tell the operator to select "Gemini 3.7 Flash High" if the installed Antigravity build exposes it; otherwise use the available 3.7 Flash option. Do not claim that the IDE always exposes High.

## TanStack settings routes and SSR locale

TanStack Router supports nested settings routes as either `settings.tsx` plus `settings/profile.tsx`, flat `settings.profile.tsx` files, or a mixture. The parent must render `<Outlet />`; the router plugin generates the route tree. [File-based routing](https://tanstack.com/router/latest/docs/routing/file-based-routing) [Routing concepts](https://tanstack.com/router/latest/docs/routing/routing-concepts)

For Morshid, keep the existing settings route as the layout, add one child route per tab, and add an index redirect or default child. Never edit `routeTree.gen.ts`. Keep stable English route slugs unless localized URLs become a separate requirement.

Locale, time zone, feature flags, and user preferences can cause hydration mismatches. TanStack Start recommends deriving a deterministic locale on the server, preferably from a cookie with `Accept-Language` as fallback, and hydrating the same value. Client-only browser preferences need a stable fallback or `ClientOnly`. [TanStack Start hydration errors](https://tanstack.com/start/latest/docs/framework/react/guide/hydration-errors)

Planning consequence: the Arabic slice must load the authenticated language before the initial render and set document language and direction server-side. Test hard refresh and language changes for hydration warnings and flashes of the wrong direction.

## Request throttling and HTTP 429

Nest's official throttler supports global guards, named windows, route overrides, custom trackers and keys, proxy-aware IP tracking, and pluggable storage. Its built-in store is in-memory; distributed deployments need shared storage. TTL values are milliseconds. [NestJS rate limiting](https://docs.nestjs.com/security/rate-limiting)

HTTP 429 means the client sent too many requests in a period. The response should explain the condition and may include `Retry-After`. [RFC 6585, section 4](https://www.rfc-editor.org/rfc/rfc6585.html#section-4) `Retry-After` is either an HTTP date or an integer number of seconds, not milliseconds. [RFC 9110, section 10.2.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3)

Planning consequence: treat HTTP abuse throttles and educational allowances as separate policies. Track authenticated traffic by account plus the relevant route/window, and protect sign-in by account and IP. Configure trusted proxies deliberately. Return a standard `Retry-After` value and a stable error body with the exact reset timestamp. Use shared storage before horizontal scaling. Idempotent replays must not consume educational allowance twice.

## Passwords and sessions

For password-only authentication, NIST SP 800-63B-4 requires at least 15 characters. Verifiers should allow at least 64, spaces, and Unicode. They must reject common or compromised passwords, rate-limit failures, avoid composition rules and periodic expiry, and allow password managers, autofill, and paste. [NIST password requirements](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/)

OWASP says password changes require an authenticated session and current-password verification. A privilege change should rotate the session ID and destroy the old ID. [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#change-password-feature) [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#renew-the-session-id-after-any-privilege-level-change)

NIST requires server-side session invalidation and timeout enforcement. Session cookies use `Secure`, the narrowest practical domain/path, and should use `HttpOnly`, `SameSite=Lax` or `Strict`, and an expiry near the session lifetime. Session secrets do not belong in `localStorage`. [NIST session management](https://pages.nist.gov/800-63-4/sp800-63b/session/)

Planning consequence: make the Admin password policy a status view, not a control that can weaken these rules. Revoking all other sessions after a password change remains a Morshid product policy, not a NIST requirement. Session listings and remote revocation need logical-session records and immediate server-side invalidation.

## WCAG 2.2 acceptance gates

Core settings journeys must meet these AA or lower-level prerequisites:

- All functions work by keyboard, focus order is logical, focus is visible and not fully obscured. [WCAG 2.2 keyboard and focus](https://www.w3.org/TR/WCAG22/#keyboard-accessible)
- Text can resize to 200% without loss, and content reflows at 320 CSS pixels without two-dimensional scrolling except for intrinsically two-dimensional content. This corresponds to 400% zoom on a 1280-pixel viewport, so a 200% browser-zoom test alone is insufficient. [Resize text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text) [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow)
- Authored component boundaries, states, and focus indicators meet 3:1 non-text contrast; color is not the only cue. [Non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- Save results, validation errors, allowance changes, and processing states are exposed as status messages without forcing focus. [Status messages](https://www.w3.org/TR/WCAG22/#status-messages)
- Pointer targets are at least 24 by 24 CSS pixels or meet a listed exception. The chosen 44-pixel touch target is a product standard above AA. [Target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- Forms have labels, text-described errors, correction suggestions, and confirmation, checking, or reversibility for changes to stored user data. [Input assistance](https://www.w3.org/TR/WCAG22/#input-assistance)

Reduced interaction motion is WCAG 2.3.3 AAA, not AA. Keep the selected system/reduce control as a deliberate product requirement. [Animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)

## Arabic and bidirectional text

Set Arabic pages to `<html lang="ar" dir="rtl">`; language does not imply direction. Use semantic HTML `dir` and CSS logical properties rather than forcing direction with CSS. Put `dir="auto"` on user-authored messages and text inputs. Isolate embedded emails, URLs, IDs, course codes, filenames, and model names with `<bdi>` or an explicit direction. [W3C HTML direction](https://www.w3.org/International/questions/qa-html-dir) [W3C inline bidi markup](https://www.w3.org/International/articles/inline-bidi-markup/)

Planning consequence: test Arabic UI containing Latin identifiers, citations, timestamps, punctuation, and mixed Arabic/Latin chat. Decide number and date formatting explicitly rather than assuming every Arabic locale uses the same digits.

## CSV formula injection

Spreadsheet programs may interpret cells beginning with `=`, `+`, `-`, `@`, tab, carriage return, line feed, or full-width variants as formulas. Correct CSV quoting alone does not stop formula execution, and delimiter or quote injection can create another dangerous cell. OWASP states that no sanitization is universal across spreadsheet programs and lossless downstream imports. [OWASP CSV injection](https://owasp.org/www-community/attacks/CSV_Injection)

Planning consequence: declare audit CSV a human spreadsheet export. Centralize serialization, quote every field, double internal quotes, and neutralize every exported cell. Test every dangerous prefix, delimiters, quotes, newlines, and full-width forms. If lossless machine interchange is later required, add a separate format instead of weakening the spreadsheet defense.

## Planning consequences for Morshid

Mandatory acceptance requirements:

- Preserve capability ownership, course isolation, auditability, privacy, idempotency, and the repository's generated-file rules.
- Meet the WCAG AA gates above, plus the agreed reduced-motion and 44-pixel product standards.
- Render the chosen locale and direction consistently on the server and client.
- Enforce the password, session, throttling, 429, and CSV safety rules above. Admin controls must not weaken security limits.
- Give every behavior change focused tests, including denial paths, reset boundaries, hard refresh, RTL mixed content, keyboard use, and adversarial CSV values.

Recommendations, not external conformance requirements:

- Use one vertical-slice brief per feature and one small `@`-based execution prompt.
- Prefer flat child route files where that keeps the current route structure intact.
- Revoke every other logical session after a password change and audit the action.
- Keep HTTP abuse limits read-only in Admin settings; allow Admins to edit only educational allowances and operational product policies.
