## Summary

- 

## Validation

- [ ] `npm run check`
- [ ] If acceptance-test behavior changed, run `npm run infra:up`, `npm run db:migrate:deploy`, and `npm run test:e2e` (followed by `npm run infra:down`)

## Scope check

- [ ] Added no auth, RBAC, RAG, embeddings, AI provider code, role shells, app Dockerfiles, or production deployment config unless this PR is explicitly scoped for that work.
- [ ] Updated `.env.example` files for any new required variables.
