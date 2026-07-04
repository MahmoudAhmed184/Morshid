# Contributing

## Workflow

Use GitHub Flow: branch from `main`, open a pull request, keep changes small, and merge only after review and CI pass.

Recommended repository protections for `main`:

- Require a pull request before merge.
- Require CI to pass.
- Require at least one approval.
- Dismiss stale approvals after new commits.
- Block force pushes and branch deletion.
- Prefer linear history or squash merge.

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

Before opening a PR, run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

Run `npm run infra:up` and `npm run db:migrate` for changes touching the database, Redis, Prisma, or readiness checks.
