# Code Review Report: `feat/auth-client`

Date: 2026-07-08
Reviewed branch: `feat/auth-client` at `c8b4891`
Base branch: `origin/dev` at `334343d`

## Scope

The branch adds the client auth shell, role routes, a landing page, form primitives, and tests.

Diff summary:

- 37 files changed
- 2,878 insertions
- Main areas: `client/src/features/auth`, `client/src/features/landing`, `client/src/routes`, `client/src/components/ui/form.tsx`

## Findings

### High: Auth is still fully mocked and does not integrate with the backend

Files:

- `client/src/features/auth/api/auth.api.ts:13`
- `client/src/features/auth/api/auth.api.ts:15`
- `client/src/features/auth/api/auth.api.ts:58`
- `client/src/features/auth/components/sign-in-form.tsx:127`
- `client/src/features/auth/components/role-placeholder-page.tsx:15`

The login flow accepts only the hard-coded password `password`, authenticates against a local `seededUsers` object, and returns mock access and refresh tokens. Logout only clears local client state and does not revoke a refresh token server-side.

This means the branch does not yet satisfy the real auth-client requirement for NestJS-backed sign-in, refresh, `/me`, and logout. It is acceptable as a local prototype only if the PR is explicitly marked as a mock/demo step.

Recommended fix:

- Replace `loginApi` with calls to the real NestJS auth endpoints.
- Add typed API functions for sign-in, refresh, `/me`, and logout.
- Make logout call the backend before clearing local state.
- Keep mock auth behind an explicit dev-only flag if it must remain.

### High: Protected routes trust localStorage state and will break or bypass incorrectly

Files:

- `client/src/features/auth/stores/auth.store.ts:68`
- `client/src/features/auth/stores/auth.store.ts:99`
- `client/src/features/auth/utils/auth-redirect.ts:20`
- `client/src/routes/admin.tsx:7`
- `client/src/routes/instructor.tsx:7`
- `client/src/routes/student.tsx:7`

`getProtectedRoleRedirectPath` reads only the Zustand store. The store marks a user authenticated from any stored JSON object that has the expected shape. A user can manually write an `admin` session into localStorage and pass the client route guard.

Also, this app is using TanStack Start SSR. On server-side route loading, `window` is unavailable, so `readStoredSession()` returns `null`. A direct page load or refresh on `/admin`, `/instructor`, or `/student` can therefore redirect to `/login` even when the browser has a stored client session.

Recommended fix:

- Treat these route guards as UX only, not authorization.
- Revalidate sessions with the backend on app boot and protected route load.
- Use server-backed route/session context for SSR, or delay client-only redirects until hydration.
- Ensure backend API guards enforce all real authorization.

### High: Refresh tokens are persisted in localStorage without versioning or safe storage handling

Files:

- `client/src/features/auth/stores/auth.store.ts:5`
- `client/src/features/auth/stores/auth.store.ts:91`
- `client/src/features/auth/stores/auth.store.ts:101`
- `client/src/features/auth/types/auth.types.ts:13`

The store persists the whole session, including `refreshToken`, in `localStorage` under an unversioned key. `setItem`, `getItem`, and `removeItem` are not consistently wrapped in `try/catch`, so disabled storage, private browsing, quota failures, or opaque origins can throw.

This also increases the blast radius of any XSS issue because the long-lived refresh token is script-readable.

Recommended fix:

- Prefer an HTTP-only secure refresh cookie if the backend can support it.
- If localStorage remains temporarily necessary, store the minimum data, use a versioned key like `morshid.auth.session:v1`, and wrap all storage operations.
- Avoid persisting refresh tokens unless there is a documented security decision accepting the risk.

### Medium: "Keep me signed in" is ignored

Files:

- `client/src/features/auth/components/sign-in-form.tsx:101`
- `client/src/features/auth/components/sign-in-form.tsx:197`
- `client/src/features/auth/components/sign-in-form.tsx:127`
- `client/src/features/auth/stores/auth.store.ts:112`

The form collects `rememberMe`, but `onSubmit` passes only email and password to `loginApi`, and `setSession` always persists the session to localStorage. If a user unchecks "Keep me signed in for 30 days", the session is still persisted.

Recommended fix:

- Pass `rememberMe` into the auth API/store flow.
- Persist only when `rememberMe` is true.
- Use memory or sessionStorage for non-persistent sessions.

### Medium: Remember-me label is disconnected from the checkbox

Files:

- `client/src/features/auth/components/sign-in-form.tsx:203`
- `client/src/features/auth/components/sign-in-form.tsx:205`
- `client/src/features/auth/components/sign-in-form.tsx:210`
- `client/src/components/ui/form.tsx:110`

The checkbox is rendered inside `FormControl`, which clones the child and replaces its `id` with the generated `formItemId`. The label still uses `htmlFor="remember-me"`, so clicking the label will not reliably toggle the checkbox and the accessible relationship is wrong.

Recommended fix:

- Use `useFormField()` to read the generated id and bind the label to that id.
- Or avoid `FormControl` for this checkbox and keep the explicit `id="remember-me"` intact.

### Medium: Sign-in validation enforces password creation rules

Files:

- `client/src/features/auth/schemas/sign-in.schema.ts:73`
- `client/src/features/auth/schemas/sign-in.schema.ts:84`
- `client/src/features/auth/schemas/sign-in.schema.ts:91`
- `client/src/features/auth/schemas/sign-in.schema.ts:98`
- `client/src/features/auth/schemas/sign-in.schema.ts:105`

The sign-in schema requires uppercase, lowercase, number, and special character rules. That belongs on password creation or password change, not sign-in. If an existing real account has a valid backend password that does not match current client-side complexity rules, the user cannot even submit the form.

Recommended fix:

- For sign-in, validate only required fields and reasonable max length.
- Let the backend decide whether credentials are valid.
- Move complexity rules to password creation/change screens.

### Medium: Vitest suite fails because localStorage is unavailable in the configured jsdom environment

Files:

- `client/vite.config.ts:12`
- `client/src/features/auth/stores/auth.store.test.ts:24`
- `client/src/features/auth/components/sign-in-form.test.tsx:68`
- `client/src/features/auth/components/role-placeholder-page.test.tsx:38`

After installing the new branch dependencies, `npm test` still fails. The failing tests all assume `window.localStorage` exists, but this test environment reports it as undefined. A direct jsdom check shows localStorage is available when jsdom is created with a non-opaque URL.

Recommended fix:

- Configure Vitest with a jsdom URL, for example:

```ts
test: {
  environment: 'jsdom',
  environmentOptions: {
    jsdom: {
      url: 'http://localhost',
    },
  },
}
```

- Add a shared test setup for browser globals such as `matchMedia` and storage if needed.

### Low: Authenticated users can still open `/login`

File:

- `client/src/routes/login.tsx:5`

The login route has no `beforeLoad` redirect for already-authenticated users. A logged-in user can navigate back to `/login` and see the sign-in form again.

Recommended fix:

- Add a login-route guard that redirects authenticated users to `getAuthRedirectPath(user.role)`.

### Low: Landing page contains non-functional links and CTAs

Files:

- `client/src/features/landing/components/landing-navbar.tsx:20`
- `client/src/features/landing/components/hero-section.tsx:41`
- `client/src/features/landing/components/landing-footer.tsx:60`
- `client/src/features/auth/components/password-field.tsx:29`

Several links are placeholders:

- Footer links all use `href="#"`.
- "Watch Demo" is a button with no action.
- "Forgot Password?" uses `href="#"`, even though forgot-password is out of P0 scope.
- Pricing/About nav links jump to footer groups rather than actual sections.

Recommended fix:

- Remove or disable non-functional actions until routes exist.
- Replace `href="#"` with real routes, `mailto:` links, or buttons that are intentionally disabled.
- Hide forgot-password if it is not in scope.

## Positive Notes

- The new auth code is organized cleanly under `features/auth`.
- The branch adds useful tests for auth API behavior, sign-in schema validation, auth redirects, and form behavior.
- TypeScript types for auth roles and session shape are small and easy to extend.
- Role-based redirect mapping is exhaustive over `AuthRole`.
- The branch keeps generated router output updated.

## Verification

Commands run after installing missing branch dependencies:

```bash
npm install
npm run typecheck
npm run lint:ci
npm run build
npm test
```

Results:

- `npm install`: passed. Warned that local Node is `v26.4.0`, while the repo requires `>=24.3 <25`.
- `npm run typecheck`: passed.
- `npm run lint:ci`: passed.
- `npm run build`: passed.
- `npm test`: failed. 35 tests fail due `localStorage` being undefined in the jsdom test environment.

Additional targeted test result:

```bash
npx vitest run src/features/auth/api/auth.api.test.ts src/features/auth/schemas/sign-in.schema.test.ts src/lib/api/health.test.ts --reporter verbose
```

Result:

- Passed: 25 tests.

## Recommended Merge Gate

Do not merge this branch as production-ready authentication yet.

Before merge, at minimum:

1. Decide whether this PR is intentionally mock-only. If yes, label it clearly and block it from production paths.
2. Fix Vitest localStorage setup so the full suite runs.
3. Fix the remember-me persistence bug and checkbox label binding.
4. Replace or isolate mock auth before any route is treated as secured.
5. Add backend-backed session validation before building real admin, instructor, or student pages on top of these guards.
