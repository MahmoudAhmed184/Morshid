## Summary

- 

## Validation

- [ ] `npm run check`
- [ ] If acceptance-test behavior changed: `npm run infra:up`, `npm run db:migrate:deploy`, and `npm run test:e2e` (followed by `npm run infra:down`)

## Scope Check

- [ ] No auth, RBAC, RAG, embeddings, AI provider code, role shells, app Dockerfiles, or production deployment config were added unless this PR is explicitly scoped for that work.
- [ ] `.env.example` files were updated for any new required variables.
