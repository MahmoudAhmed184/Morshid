# Contributing

## Workflow

Use Practical GitFlow:

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

CODEOWNERS is deferred until GitHub users or teams are known.

## Commits

Use Conventional Commits with a scope:

```txt
feat(server): add health readiness endpoints
build(infra): add docker compose services
docs(readme): document local setup
```

Keep the subject imperative, concise, and lowercase after the scope.

## Local Checks

Before opening a PR, run the same canonical check used by CI:

```bash
npm run check
```

This checks formatting, strict linting, type safety, frontend and backend unit
tests, and production builds.

For changes covered by server acceptance tests, also run the complete E2E
sequence:

```bash
npm run infra:up
npm run db:migrate:deploy
npm run test:e2e
npm run infra:down
```

Always run `npm run infra:down` when finished, including after a failed
migration or test run. `infra:up` starts the required Docker Compose services:

- PostgreSQL with pgvector at `localhost:5432`, using database and user
  `morshid` and password `morshid_local_password` by default.
- Redis at `redis://localhost:6379`.

The acceptance-test defaults are:

```dotenv
DATABASE_URL=postgresql://morshid:morshid_local_password@localhost:5432/morshid
REDIS_URL=redis://localhost:6379
CLIENT_ORIGIN=http://localhost:3000
AUTH_ACCESS_TOKEN_SECRET=test-access-token-secret-with-at-least-32-characters
AUTH_REFRESH_TOKEN_HASH_SECRET=test-refresh-token-hash-secret-with-at-least-32-characters
AUTH_ACCESS_TOKEN_TTL_SECONDS=900
AUTH_REFRESH_TOKEN_TTL_DAYS=7
```

No GitHub Actions secrets are required for this gate. CI creates PostgreSQL
and Redis locally with ephemeral credentials, and the E2E auth values are
deterministic test-only secrets. Never reuse them outside automated or local
test environments.
