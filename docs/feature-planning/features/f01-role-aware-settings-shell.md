# F01: Role-aware settings shell

**Difficulty:** Easy  
**Dependencies:** None

## Outcome

Replace the shared one-page settings route with a deep-linkable shell that
composes only the tabs available to the authenticated role.

## Current state

Student, Instructor, and Admin settings routes all render the same
`AccountSettingsPage`. It contains profile facts, appearance controls, and
sign-out with no tab navigation.

## Contract

- Preserve the role guards and workspace chrome already surrounding each route.
- Use the tab sets and responsive navigation in `program-contract.md`.
- Make the existing settings route the layout, render an outlet, and give each
  tab a stable English child-route slug. The index route redirects to Account.
- A hard refresh and browser history navigation reopen the same tab without a
  content flash or hydration warning.
- A role cannot navigate to another role's tab. Unknown tabs use the normal
  route-not-found behavior rather than a compatibility redirect.
- The shell owns navigation and page hierarchy only. Each feature owns its
  forms, queries, mutations, errors, and authorization.

## Implementation sequence

1. Add shell tests for role tab visibility, deep links, mobile selection,
   keyboard use, and the default redirect.
2. Introduce a small tab descriptor interface and compose descriptors in role
   workspaces.
3. Convert the settings routes to layouts and add the child routes.
4. Generate the TanStack route tree through the repository command.

## Acceptance criteria

- [ ] Each role sees exactly its approved tabs on desktop and mobile.
- [ ] Tab state lives in the URL and survives refresh, back, and forward.
- [ ] Navigation exposes the active item and an accessible page heading.
- [ ] The layout reflows at 320 CSS pixels without horizontal page scrolling.
- [ ] Existing account settings remain reachable during the split.
- [ ] Focus moves predictably after route navigation and pending routes show a
      stable content fallback.

## Out of scope

Implementing the behavior inside later tabs, localized route slugs, or a new
visual identity.

