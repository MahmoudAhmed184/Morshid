# Contributing

## Workflow

Practical GitFlow rules:

- `dev` is the default integration branch.
- Create feature branches from `dev`.
- Open routine pull requests back into `dev`.
- Keep `main` release-only. `main` receives release pull requests from `dev` after review and CI pass.
- Create hotfix branches from `main`, merge the hotfix to `main`, then merge the fix back into `dev`.

Recommended repository protections for `main`:

- Require a pull request before merge.
- Require the `validate` CI check to pass.
- Require branches to be up to date before merge.
- Require at least one approval.
- Dismiss stale approvals after new commits.
- Require conversation resolution.
- Require linear history.
- Enforce these rules for admins.
- Block force pushes and branch deletion.
- Do not enable GitHub's absolute branch lock; `main` should remain releasable through reviewed release and hotfix pull requests.

## Commits

Use Conventional Commits with a scope:

```txt
feat(server): add course readiness check
build(infra): update redis container image
docs(readme): clarify embedding profile migration
```

Keep the subject imperative, concise, and lowercase after the scope.

## Local checks and quality gate

Before opening a pull request, run the checks used by CI:

```bash
npm run check
```

This command runs:
1. Code formatting check (`format:check`).
2. ESLint checks across root, client, and server (`lint:ci`).
3. TypeScript type checking across all workspaces (`typecheck`).
4. Architectural boundary checks via dependency-cruiser (`test:architecture`).
5. Generated code integrity check (`test:generated-ownership`).
6. Unit tests across all workspaces (`test`).
7. Production builds for client and server (`build`).

### Integration and acceptance testing

For changes that touch API contracts, database migrations, or UI workflows, run the integration and acceptance suites:

```bash
# Start local PostgreSQL (with pgvector) and Redis
npm run infra:up

# Run database migrations
npm run db:migrate:deploy

# Run server E2E integration tests
npm run test:e2e

# Run Playwright browser acceptance tests
npm run test:acceptance

# Stop infrastructure containers when done
npm run infra:down
```

Always run `npm run infra:down` when finished.

### Acceptance test environment defaults

```dotenv
DATABASE_URL=postgresql://morshid:morshid_local_password@localhost:5432/morshid
REDIS_URL=redis://localhost:6379
CLIENT_ORIGIN=http://localhost:3000
AUTH_ACCESS_TOKEN_SECRET=test-access-token-secret-with-at-least-32-characters
AUTH_REFRESH_TOKEN_HASH_SECRET=test-refresh-token-hash-secret-with-at-least-32-characters
AUTH_ACCESS_TOKEN_TTL_SECONDS=900
AUTH_REFRESH_TOKEN_TTL_DAYS=7
ANALYSIS_MODEL_PROVIDER=deterministic
TUTOR_MODEL_PROVIDER=deterministic
SEMANTIC_GUARD_PROVIDER=deterministic
EMBEDDING_PROVIDER=deterministic
PDF_STORAGE_PATH=../storage/pdfs
```

Deterministic model providers and test credentials run locally and in CI without requiring external API keys. Never reuse test secrets in production environments.
