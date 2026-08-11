<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Database seed

From the repo root, prefer:

```bash
$ npm run db:seed
```

From this workspace, use the server-local entrypoint:

```bash
$ npm run db:seed
```

The seed expects the local PostgreSQL service to be running and migrations to
be applied. It loads the P0 demo accounts, the `PYTHON-PROG-P0` Python
Programming course, and an unassigned `HIDDEN-ISOLATION` course. All seeded
accounts use the local-only password `MorshidDemoP0!`.

## P0 auth sessions

The P0 auth API returns both the access token and refresh token in JSON and sets
the refresh token in the HttpOnly `morshid_refresh` cookie. Clients send the
access token as a `Bearer` token. Browser clients use the refresh cookie for the
refresh/logout endpoints; non-browser clients can use the optional
`refreshToken` JSON field as a fallback.

Passwords are stored as Argon2id hashes with per-password salt material encoded
in the stored hash string. The current hash format records the algorithm,
version, memory cost, pass count, parallelism, output length, salt, and hash
value. Password verification recomputes Argon2id from the stored parameters and
uses a timing-safe comparison.

### Auth environment configuration

Configure these values in `server/.env`. NestJS validates them at startup and
also reads `.env` / `../.env` as fallbacks for local development.

| Variable                         | Required | Default | Purpose                                                                                                                       |
| -------------------------------- | -------: | ------: | ----------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_ACCESS_TOKEN_SECRET`       |      Yes |    None | Secret used to sign and verify access JWTs. Use a unique random value with at least 32 characters per environment.            |
| `AUTH_REFRESH_TOKEN_HASH_SECRET` |      Yes |    None | Secret used to HMAC refresh tokens before database storage. Use a different unique random value from the access-token secret. |
| `AUTH_ACCESS_TOKEN_TTL_SECONDS`  |       No |   `900` | Access-token lifetime in seconds. The default is 15 minutes.                                                                  |
| `AUTH_REFRESH_TOKEN_TTL_DAYS`    |       No |     `7` | Refresh-token lifetime in days.                                                                                               |

Access tokens are JWTs signed by `@nestjs/jwt` / `jsonwebtoken` with the current
HMAC SHA-256 default (`HS256`) and `AUTH_ACCESS_TOKEN_SECRET`. The token payload
contains `sub` for the user id and `typ: "access"`. Changing
`AUTH_ACCESS_TOKEN_SECRET` invalidates existing access tokens.

Refresh tokens are opaque random values returned once to the client. The server
stores only `HMAC-SHA256(refreshToken, AUTH_REFRESH_TOKEN_HASH_SECRET)` in the
`refresh_tokens.token_hash` column, with `expires_at`, `revoked_at`, and
`replaced_by_token_id` tracking expiry, logout/revocation, and rotation history.
Changing `AUTH_REFRESH_TOKEN_HASH_SECRET` prevents existing refresh tokens from
matching stored hashes, effectively forcing users to sign in again.

On refresh, the submitted refresh token is hashed, the matching active database
record is revoked, a new refresh token record is created, and the old record is
linked to the new one. Reusing the prior token after rotation is rejected as an
invalid refresh token.

## Tutoring model roles

Tutoring has three explicit model roles: educational analysis, tutor response
generation, and semantic guarding. Each role is configured independently so
model identity and failure policy cannot be confused across stages:

- ANALYSIS_MODEL_* selects educational analysis.
- TUTOR_MODEL_* selects the Socratic tutor response model.
- SEMANTIC_GUARD_* selects semantic response validation.

The committed deterministic provider is keyless and offline, so it is the
default for local development, CI, and deterministic tests. An
openai-compatible provider may be selected for a configured deployment
gateway. Remote model and embedding calls always occur outside database
transactions; terminal conversation, attempt, audit, and review writes join
one caller-owned transaction.

The role-chain smoke is opt-in and requires the documented external model
configuration:

bash command: npm run test:tutoring:live

It reports only bounded provider/model metadata and outcome information. It is
excluded from npm run check; deterministic workflow and governance tests
remain the required local verification.

## Embedding profiles and strict course readiness

Every stored chunk records the **document profile** that produced its vector in
`material_chunks.embedding_model`. Retrieval filters on the active provider's
profile, because vectors from different providers all have 1,536 dimensions:
Postgres will happily compute a cosine distance between a Gemini query vector
and a deterministic stored vector. That comparison is mathematically valid and
semantically meaningless, and it surfaces as plausible false matches rather
than as an error, so it must be excluded structurally rather than detected.

Before a query is embedded, the retrieval service checks profile coverage for
the course:

> **Strict course readiness** — one incompletely embedded candidate material
> blocks grounded retrieval for that entire course.

A candidate material is `READY` or `WARNING`, not soft-deleted, and has an
extracted text length above zero. It is complete when its `chunk_count` is
positive and at least that many of its chunks carry the active profile. Partial
coverage would answer from whichever materials happened to be migrated first,
and a student cannot tell a thin answer from a complete one.

Readiness runs before the query is embedded, so a course with no compatible
vectors never spends provider quota building a query vector it could not use.
Readiness and retrieval are separate queries rather than one atomic snapshot,
so a concurrent material replacement can produce a transient not-ready or
no-evidence result; the profile filter still prevents cross-space comparisons,
which is the property that matters.

### Restricted Gemini embedding demo

Selecting `EMBEDDING_PROVIDER=gemini` is refused when `NODE_ENV=production` and
additionally requires `GEMINI_EMBEDDING_DEMO_ACKNOWLEDGED=true`. That is
**Morshid's own free-tier data-governance policy, not an API constraint**: the
free tier lets Google use submitted inputs to improve its products, and course
material is not ours to donate. Only synthetic, permission-safe material may be
embedded through it.

`GEMINI_EMBEDDING_API_KEY` must be distinct from `GEMINI_API_KEY` **and live
under a separate Google Cloud project**. Gemini rate limits are per project, so
a shared key would let one PDF ingest starve student chat. The schema can only
prove the two keys differ; project separation is an operator responsibility.

There is no `GEMINI_EMBEDDING_MODEL`. The model, its dimensions, and the
document formatting together _are_ the persisted document profile
(`gemini/gemini-embedding-2/1536/document-v1`), so the model is pinned in code —
an environment variable would let an operator split the corpus across two vector
spaces under one `embedding_model` value.

#### Quota vocabulary

The five caps are **local admission-control caps informed by the project's
published Gemini limits**. They do not reproduce Google's enforcement:

- Google's requests-per-day resets at midnight Pacific; this guard's day window
  is epoch-aligned UTC, 7–8 hours earlier.
- The minute dimensions are token buckets, not Google's undisclosed algorithm.
- `LOCAL_REQUESTS_PER_HOUR` and `LOCAL_REQUESTS_PER_30_DAYS` are entirely
  Morshid-owned policy with no provider counterpart at all.

Provider-side `429 RESOURCE_EXHAUSTED` responses remain authoritative.

`GEMINI_EMBEDDING_INPUT_TOKENS_PER_MINUTE` keeps its name because it maps
conceptually to the upstream constraint, but the value metered against it is
`estimatedInputUnits` — UTF-8 bytes of the final formatted input — and never an
actual token count. The estimate is reserved atomically before each request and
then kept: it is never reconciled or refunded, because the pinned SDK's
Developer-API response conversion discards `usageMetadata` entirely, so there is
no actual count to reconcile against. A pinned-SDK contract test asserts that,
so an SDK upgrade that changes it fails loudly.

`GEMINI_EMBEDDING_QUOTA_PROJECT_ID` is an opaque deployment label (for example
`embedding-project-01`), not the real Google project name. The budget is keyed
on it rather than on the credential, so every replica on one Google project
shares a bucket and a credential rotation never mints a fresh day or 30-day
window.

#### Live smoke check

```bash
npm run test:gemini-embedding:smoke
```

It confirms only what documentation cannot: the selected API version (`v1beta`),
one embedding per `Content`, 1,536 dimensions, that the configured 32-input
operational batch succeeds, and semantic ordering over held-out fixtures. Note
the wording — a successful 32-input request establishes that **the configured
operational batch succeeds**, not the model's maximum; claiming a maximum
requires deliberately probing increasing sizes.

### AWS Bedrock embedding is not available

`EMBEDDING_PROVIDER` accepts `deterministic` and `gemini` only. An ITI Cohere
embedding adapter is deliberately not implemented. The gateway's current public
integration bundle documents `/student/embed` and the
`{model_id,texts,input_type}` request, but the redacted Cohere request returned
HTTP 403. The model approval, successful response envelope, preserved
1,536-dimensional output, input echo behavior, and practical batch capacity
therefore remain unverified. Implementing against an invented success envelope
would hide contract drift rather than expose it. See "Embedding endpoint — live
probe denied" in `docs/aws-bedrock-iti-gateway-research.md`.

After the ITI dashboard shows `us.cohere.embed-v4:0` as approved, rerun the
single-request structural probe with:

```bash
npm run test:iti-bedrock-embedding:probe
```

It emits only response property names, a shape label, vector count,
dimensionalities, and whether the synthetic input was echoed. It never emits a
credential, header, URL, source string, body, or vector component.

### Switching embedding providers

The schema stores one vector and one model id per chunk, and replacement is
transactional only per material — there is no corpus-wide transaction, so a
transition is necessarily mixed while it runs. Normal material processing also
uses the _configured_ provider, so a migration cannot run alongside it.

The exclusion mechanism is **operational maintenance mode, not a lock**. A
migration lock would only provide mutual exclusion if the normal workers
participated in the same protocol; material processing uses lease records and
would not check a new embedding-migration lock, so such a lock would protect
nothing.

```text
disable grounded retrieval → stop/scale material-processing workers to zero
→ verify no active, unexpired processing leases → run the resumable migration
→ verify complete target-profile coverage → switch EMBEDDING_PROVIDER
→ restart workers and retrieval
```

The migration step is:

```bash
npm run embedding:migrate -- gemini      # or: deterministic
```

The target is an **explicit argument**, and its configuration is validated
independently of `EMBEDDING_PROVIDER` — the whole point is to migrate _before_
switching, so the target is deliberately not the configured provider. For a
Gemini target this means `GEMINI_EMBEDDING_*` must be set while
`EMBEDDING_PROVIDER` is still `deterministic`; the command forces the target
through that same full schema gate itself.

Every run scans **all** candidate materials, checks each one's current
target-profile coverage, skips the complete ones, and retries every incomplete
one — so re-running it is the resume mechanism. It exits non-zero unless the
whole target corpus is covered, which is what stops an operator switching
providers off a partially successful run. It re-embeds the **persisted chunk
text and material title** and never re-extracts a PDF: re-extraction could
change chunk boundaries if the extractor or chunker has evolved, silently
turning a provider migration into an undocumented content migration.

Rollback is reprocessing with the previous provider. A zero-degradation rolling
migration would require storing multiple profiles per chunk — a schema redesign
that is explicitly out of scope.

## Local OpenAPI documentation

When `NODE_ENV` is `development` or `test`, the server publishes:

- Swagger UI: http://localhost:4000/docs
- OpenAPI JSON: http://localhost:4000/docs-json
- OpenAPI YAML: http://localhost:4000/docs-yaml

The documentation routes are not registered in production and return `404`;
normal API and health routes are unaffected. Swagger UI exposes two named
authorization schemes:

- `access-token`: enter the JWT returned by sign-in or refresh. Swagger sends it
  as an HTTP bearer token to protected operations.
- `refresh-session`: the browser sends the HttpOnly `morshid_refresh` cookie to
  refresh and logout. Those operations also document the optional
  `refreshToken` JSON fallback for clients that do not use cookies.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
