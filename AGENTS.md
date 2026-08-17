# Morshid Guidelines

## Working rules

* Keep changes small, local, and easy to understand.
* Prefer the simplest solution that fully solves the current problem. Do not build for hypothetical future requirements.
* Follow an existing pattern before creating a new abstraction.
* Add abstractions only for real boundaries or real variation.
* Keep one implementation. When replacing something, remove the old path—no wrappers, aliases, duplicate flows, or dead compatibility code.
* Prefer existing dependencies and framework conventions over custom machinery. Check official docs and types when needed.
* Stay within the task. Preserve unrelated work and avoid drive-by cleanup.
* Never hand-edit `client/src/routeTree.gen.ts` or `server/src/generated/prisma`.

## Architecture

Morshid is an npm workspace with a TanStack Start/React client and a NestJS API.

Server product code belongs in `server/src/modules/`, organized by capability. Shared framework primitives belong in `server/src/common/`; technical infrastructure belongs in `server/src/platform/`. `common` and `platform` must not depend on product modules.

Client domain behavior belongs in `client/src/features/`. Role-specific composition belongs in `client/src/workspaces/`. Keep routes thin. `client/src/app/` owns application composition. Shared `components/` and `lib/` code must remain feature-independent.

Use `@/*` for client source imports.

Cross-owner dependencies go through small, explicit named interfaces. Avoid broad barrels, generic dumping grounds, and unnecessary directory nesting.

The current code, tests, architecture checks, and accepted ADRs define the repository architecture. Do not silently violate an ADR; supersede it explicitly when the architectural decision genuinely changes.

## Code

Use strict TypeScript.

Prefer inference when the type is obvious and explicit types at real boundaries. Avoid `any`, use type-only imports where appropriate, and handle promises explicitly.

Follow the repository style: two spaces, single quotes, no semicolons, trailing commas, kebab-case filenames, PascalCase components/classes, and camelCase functions/variables.

Do not introduce a service, helper, interface, event, injection token, or other abstraction just to make the code look architected.

## Tests

Add focused regression coverage for behavior changes. Test behavior and contracts, not implementation details. Never weaken a test just to make a change pass.

Keep unit tests close to the behavior they test. Server E2E tests live in `server/test/`; browser journeys live in `tests/acceptance/`.

Use focused tests while working. Before finishing, run:

`npm run check`

Run `npm run test:e2e` and/or `npm run test:acceptance` when the affected surface requires them.

The architecture gate is part of the repository contract. Do not bypass it or add exceptions just to make a change pass.

## Git

Branch from `dev` and target normal PRs to `dev`. `main` is for releases and hotfixes.

Use scoped Conventional Commits with concise, imperative subjects:

`feat(server): add course readiness check`

Use `p=#N` only on PR merge commits, never regular branch commits.

Never commit credentials, private course material, or student data.
