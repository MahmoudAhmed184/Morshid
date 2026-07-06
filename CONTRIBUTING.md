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

Before opening a PR, run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

Run `npm run infra:up` and `npm run db:migrate` for changes touching the database, Redis, Prisma, or readiness checks.
