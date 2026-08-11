# Repository Guidelines

## Project Structure & Module Organization

Morshid is an npm workspace. `client/` contains the TanStack Start/React frontend; organize product code by domain under `client/src/features/`, shared UI under `client/src/components/`, routes under `client/src/routes/`, and static assets under `client/public/`. `server/` contains the NestJS API; feature modules live in `server/src/modules/`, shared infrastructure in `server/src/common/`, and Prisma schema, migrations, and seeds in `server/prisma/`. Root `tests/acceptance/` holds Playwright scenarios, while `server/test/` holds API E2E tests. Project notes belong in `docs/`. Do not hand-edit generated Prisma code or `client/src/routeTree.gen.ts`.

## Build, Test, and Development Commands

- `npm install`: install locked dependencies for all workspaces (Node 24, npm 11).
- `npm run infra:up`: start PostgreSQL/pgvector and Redis with Docker Compose.
- `npm run db:migrate && npm run db:seed`: prepare deterministic local data.
- `npm run dev`: run client on port 3000 and API on port 4000.
- `npm run check`: run formatting checks, strict linting, type checks, tests, and production builds; this is the canonical pre-PR gate.
- `npm run test:acceptance`: run browser acceptance tests against the local stack.
- `npm run test:e2e`: run server E2E tests; start infrastructure and deploy migrations first.

## Coding Style & Naming Conventions

Use two-space indentation, single quotes, no semicolons, and trailing commas; Prettier enforces these rules. ESLint applies strict, type-aware TypeScript checks. Prefer type-only imports, avoid `any`, and explicitly handle promises. Use kebab-case filenames (`course-access.service.ts`), PascalCase for React components and NestJS classes, and camelCase for functions and variables. Keep frontend logic within its feature and preserve NestJS controller/service/repository boundaries.

## Testing Guidelines

Use Vitest and Testing Library for client tests, Jest for server unit/E2E tests, and Playwright for acceptance coverage. Name unit tests `*.test.ts(x)` or `*.spec.ts`; name server E2E files `*.e2e-spec.ts`. Co-locate unit tests with implementation code. There is no numeric coverage threshold, but every behavior change should add focused regression coverage. Run `npm test` during development and `npm run check` before submission.

## Commit & Pull Request Guidelines

Follow scoped Conventional Commits: `feat(server): add readiness endpoint`. Subjects should be imperative, concise, and lowercase after the scope. The `p=#N` suffix (for example, `p=#92`, where `p` refers to the PR number) belongs only in the merge commit subject when merging a PR — never add it to regular commits on a branch. Branch from `dev` and target routine PRs back to `dev`; reserve `main` for releases and hotfixes. Complete the PR template with a clear summary, validation results, and updated `.env.example` files for new configuration. Link the issue and include screenshots for visible UI changes. Never commit credentials, private course material, or student data.

## Approved architecture authority

For changes to architecture, database structure, module ownership, tests,
generated files, or product contracts, read and follow the approved
[`docs/architecture-refactor-plan-2026-08-11.md`](docs/architecture-refactor-plan-2026-08-11.md)
and its applicable ADRs. The plan and ADRs are the current architectural
authority; dated research and historical documents are evidence and must be
labeled when they describe superseded behavior.

Apply these rules to every implementation decision:

1. Remove obsolete paths after direct cutover. Keep one implementation, not
   forwarding wrappers, deprecated re-exports, aliases, dual schemas, dual
   state machines, or fallback compatibility branches.
2. Choose the simplest implementation that fully satisfies current
   requirements. Add a seam only for genuine variation or a real
   cross-module interface.
3. Grow in working vertical slices. Each milestone leaves the product
   buildable and tested end to end.
4. Keep modules deep: substantial behavior sits behind a small interface;
   internal implementation detail stays private.
5. Keep concerns separate through ownership and dependency direction, not
   uniform directory silhouettes.
6. Prefer established, maintained libraries and existing project
   dependencies. Check documentation and types before adding or rebuilding
   capability.
7. Make long-term architectural decisions. Do not add stopgaps intended for
   later replacement.
8. Study official framework conventions and established products before
   inventing a local pattern. Record a new design decision in an ADR with its
   evidence; mechanical work may cite the approved plan or research.
9. Preserve generated-file ownership. Never hand-edit
   `client/src/routeTree.gen.ts` or `server/src/generated/prisma`.
10. Preserve repository style: two spaces, single quotes, no semicolons,
    trailing commas, strict typed TypeScript, and kebab-case filenames.
