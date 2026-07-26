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

## Restricted Gemini completion demo

`COMPLETION_PROVIDER` accepts `deterministic`, `aws-bedrock`, and `gemini`. It
defaults to `deterministic`, which is keyless and offline in production, CI, and
normal tests; `aws-bedrock` is documented in the next section. Gemini's adapter,
quota guard, and constants live under
`src/modules/completion/providers/gemini/`. Each provider's startup rules are
gated on that provider being selected, so a Gemini deployment is never asked for
gateway configuration and a gateway deployment is never asked for Gemini caps.
The free tier must receive only synthetic, permission-safe content; do not send
real student activity, private course materials, assessments, PII, data from
minors, or any content that has not been approved for this use.

`COMPLETION_PROVIDER=gemini` is accepted only under two independent conditions:

- `NODE_ENV` must not be `production`. Free-tier inputs and outputs may be used
  to improve Google's products, so this provider must never serve real users.
  This is the load-bearing restriction; it is *not* expressed as
  "`development` only", because forcing `NODE_ENV` would also change unrelated
  security behaviour (the refresh cookie's `Secure` flag, unauthenticated
  Swagger at `/docs`, and the absolute-`PDF_STORAGE_PATH` requirement) and would
  make the provider unusable from the `NODE_ENV=test` end-to-end suite.
- `GEMINI_DEMO_ACKNOWLEDGED=true` must be set explicitly. It is an operator
  acknowledgement, not a feature switch: setting it states that you accept that
  free-tier prompts and completions may be reviewed and used to improve Google's
  products, and that only synthetic, permission-safe data will be sent. The
  variable defaults to false and reads a blank value as false, so a Gemini
  deployment can never be reached by inheriting an ambient environment.

Before enabling the demo:

1. Revoke the exposed credential without making a test request with it. Review
   its usage in AI Studio, then create a new **authorization key**. Google plans
   to reject standard keys starting in September 2026; see the
   [API-key guidance](https://ai.google.dev/gemini-api/docs/api-key).
2. Copy the commented Gemini variables from `.env.example` into the ignored
   `server/.env`. Never commit the replacement key.
3. Keep the stable `gemini-3.5-flash-lite` model ID unless an approved stable,
   non-preview override is required. Do not use a moving `-latest` alias; see
   the [model guidance](https://ai.google.dev/gemini-api/docs/latest-model).
4. In the signed-in AI Studio quota view, read the project/model RPM, input
   TPM, and RPD values. Configure effective caps no higher than 90% of those
   values, plus explicit Morshid hour and month budgets. Limits vary by project,
   model, and tier and are not guaranteed; see the
   [rate-limit guidance](https://ai.google.dev/gemini-api/docs/rate-limits).
   **The five request caps must satisfy
   `GEMINI_REQUESTS_PER_MINUTE <= GEMINI_REQUESTS_PER_HOUR <= GEMINI_REQUESTS_PER_DAY <= GEMINI_REQUESTS_PER_MONTH`,
   or the server refuses to boot.** Copying the AI Studio RPM/RPD at 90% and
   then picking hour and month budgets independently can easily violate it — for
   example an RPD of 1500 with a 1000/month internal budget is rejected. Choose
   the hour and month budgets after the provider-derived values, not before.
   (`GEMINI_INPUT_TOKENS_PER_MINUTE` is a separate token dimension and is not
   part of that ordering.)
5. Set `GEMINI_DEMO_ACKNOWLEDGED=true`.
6. Start Redis through `npm run infra:up`. Compose enables Redis AOF on the
   `morshid-redis-data` volume so long-window local budgets survive restarts.

### How each cap is metered

The guard does not meter every dimension the same way, and the units are not
interchangeable with the AI Studio dashboard's:

| Variable | Window |
| --- | --- |
| `GEMINI_REQUESTS_PER_MINUTE` | Continuously refilling token bucket over 60s |
| `GEMINI_INPUT_TOKENS_PER_MINUTE` | Continuously refilling token bucket over 60s |
| `GEMINI_REQUESTS_PER_HOUR` | Continuously refilling token bucket over 1h |
| `GEMINI_REQUESTS_PER_DAY` | **Fixed window**, resets at 00:00 UTC |
| `GEMINI_REQUESTS_PER_MONTH` | **Fixed window**, epoch-aligned 30 days — not a calendar month, so it does not reset on the 1st |

The two long budgets are fixed windows rather than rolling ones on purpose: a
rolling budget drained just after a reset and again just before the next one
yields roughly twice the configured cap inside one accounting day.

Google resets requests-per-day at midnight **Pacific** (07:00 UTC under PDT,
08:00 UTC under PST), while this guard rolls over at midnight UTC, so the Morshid
day boundary leads Google's by 7-8 hours. UTC alignment is deliberate — it needs
no timezone database inside the Lua script and no application clock — but it
means an operator comparing the local counter against the AI Studio daily figure
is looking at two different accounting days. Size `GEMINI_REQUESTS_PER_DAY`
against the AI Studio RPD number, then expect the local counter to roll over
earlier in the day than the dashboard's.

The budget is keyed on the configured `GEMINI_API_KEY` (as a salted, truncated
digest; the key itself never reaches Redis), because Gemini limits are applied
per Google project rather than per model. Changing `GEMINI_MODEL` therefore keeps
the existing day and month spend, and two deployments sharing one Redis with
different API keys keep separate budgets.

Gemini configuration is intentionally absent from the production Compose
server profile, which also pins `NODE_ENV: production` and so cannot accept
`COMPLETION_PROVIDER=gemini` at all. `store: false` prevents Interactions
storage, but free-tier
inputs and outputs may still be reviewed or used to improve Google products.
Real pilot or production data requires a separately approved paid/no-training
arrangement. Review the
[Gemini terms](https://ai.google.dev/gemini-api/terms) and
[Interactions retention guidance](https://ai.google.dev/gemini-api/docs/interactions-overview)
before changing this boundary.

After the key has been rotated and the local caps are configured, run the
opt-in synthetic smoke once:

```bash
npm run test:gemini:smoke
```

The command is deliberately excluded from `npm run check`. It prints only the
provider, model, prompt version, and token counts, and it consumes the same
Redis quota guard as the application.

## AWS Bedrock completion through ITI

Morshid defaults to the deterministic completion provider, which is keyless,
offline, and used by CI. Selecting `aws-bedrock` preserves the same public
completion contract and sends one request through the
[ITI Student Bedrock Gateway](https://apiaccess.iti.net.eg/student/integration).
ITI remains the credential authority and owns AWS access, budgets, account
policy, and usage accounting. Morshid has no direct AWS credentials and uses
neither the AWS SDK nor LangChain.

The primary-source basis for this design — the published ITI contract, the
one-`POST`-no-retry rule, the bounded response read, `redirect: 'error'`, the
plaintext exception, and the dated model-qualification record — is written up in
[`docs/aws-bedrock-iti-gateway-research.md`](../docs/aws-bedrock-iti-gateway-research.md).

Before a live test, rotate the ITI gateway key. Store the replacement only in
the git-ignored `server/.env`, set that file to mode `0600`, and never place the
key in a command line, test fixture, example file, or log. Start from
`server/.env.example` and set:

```dotenv
COMPLETION_PROVIDER=aws-bedrock
COMPLETION_TIMEOUT_MS=60000
ITI_BEDROCK_GATEWAY_BASE_URL=https://apiaccess.iti.net.eg/api/v1
ITI_BEDROCK_GATEWAY_API_KEY=<rotated key in server/.env only>
ITI_BEDROCK_ALLOW_INSECURE_HTTP=false
AWS_BEDROCK_MODEL_ID=<exact approved model ID>
AWS_BEDROCK_ALLOWED_MODEL_IDS=<comma-separated approved model IDs>
AWS_BEDROCK_MAX_TOKENS=1024
```

There is deliberately no committed model ID. The selected model must be in the
bounded, duplicate-free local allow-list of at most 50 IDs. Copy exact IDs from
the portal's **Approved models** list; a model or allow-list change requires a
server restart.

With `aws-bedrock` selected, startup fails when any of the following holds:
`ITI_BEDROCK_GATEWAY_API_KEY` is unset, empty, or contains anything outside
printable ASCII (`U+0021`–`U+007E`); `AWS_BEDROCK_MODEL_ID` is empty;
`AWS_BEDROCK_ALLOWED_MODEL_IDS` is empty, holds duplicates, or omits the
selected model; or `ITI_BEDROCK_GATEWAY_BASE_URL` fails transport policy. The
key is sent as an `Authorization` header value, where a non-ASCII character
would throw on every request, so it is rejected once at boot instead.

Transport policy requires HTTPS (or the explicit exception below), no userinfo,
query, or fragment — including a bare trailing `?` or `#`, which would otherwise
corrupt the request path — and a host that is not `localhost`, loopback,
link-local, or a private IP range, so a stale value cannot ship the bearer key
to a metadata service.

`ITI_BEDROCK_GATEWAY_BASE_URL` and `AWS_BEDROCK_MAX_TOKENS` both have committed
defaults and can never be "missing". Two consequences are worth knowing:

- Transport policy is applied only when `aws-bedrock` is selected, so a
  `COMPLETION_PROVIDER=deterministic` deployment boots whatever
  `ITI_BEDROCK_GATEWAY_BASE_URL` holds, as long as the value still parses as a
  URL.
- `AWS_BEDROCK_MAX_TOKENS` is bounded to 256–4096 for every provider. The 256
  floor is not cosmetic: the research note records a probe where a very small
  budget returned HTTP 200 with blank output while still billing a usage event.

`ITI_BEDROCK_ALLOW_INSECURE_HTTP` accepts only `true`, `false`, or blank, and a
blank value means `false`, so the blank-valued committed examples and Compose's
`${VAR:-}` pass-through cannot block startup.

The adapter sends exactly one non-retried `POST` to
`${ITI_BEDROCK_GATEWAY_BASE_URL}/student/chat` with `redirect: 'error'`, so a
bearer-authenticated request is never resent to a redirect target. It has no
model, transport, retry, or protocol fallback, so failures cannot silently
consume budget through a second attempt. The response body is read
incrementally and rejected past 256 KiB — the larger of a fixed floor and the
byte width of a maximum-length UTF-8 answer, so a long Arabic or emoji reply is
not mistaken for an oversized response.

Every distinguishable upstream failure collapses into the same public error, so
the adapter writes one server-side diagnostic before rethrowing: the failure
category (`http_status`, `transport`, `oversized_response`,
`malformed_response`, `invalid_output`, `blank_output`, or `cancelled`), the
HTTP status when there was one, and the allow-listed model ID. The key, the
endpoint, the prompt, the student content, and every byte of the gateway
response are excluded by construction. Cancellation logs at `warn`; every other
category logs at `error`.

### Why the environment variables are split

`ITI_BEDROCK_*` names the transport Morshid actually speaks to: the
ITI-operated gateway, its base URL, its key, and the plaintext exception.
`AWS_BEDROCK_*` names model policy that originates at AWS and is enforced
locally: the model ID, the local allow-list, and the output token budget. The
adapter lives at
`src/modules/completion/providers/aws-bedrock/iti-bedrock-gateway.adapter.ts`
for the same reason — the provider selector is the model family, while the
implementation is the ITI gateway. `server/.env.example` groups the variables
along the same line.

### Temporary local HTTP exception

Bearer credentials and prompts should travel over HTTPS. If ITI's HTTPS
endpoint is temporarily unavailable, development may opt into the known
plaintext endpoint only with all three settings below:

```dotenv
NODE_ENV=development
ITI_BEDROCK_GATEWAY_BASE_URL=http://apiaccess.iti.net.eg/api/v1
ITI_BEDROCK_ALLOW_INSECURE_HTTP=true
```

This knowingly insecure exception is accepted only outside production — the
check rejects `NODE_ENV=production`, not everything other than `development` —
and only for that exact host, default port, and base path. Enabling it emits one
fixed, credential-free startup warning and still performs a single request to
the configured URL. The scheme is read from the parsed URL rather than from the
raw string, so an `HTTP://` spelling behaves identically and is warned about
identically. It never tries HTTPS before HTTP. Production and Compose reject the
exception. Return to HTTPS as soon as ITI restores it.

For one opt-in local verification:

1. Record the current ITI usage-event count.
2. Start infrastructure, migrate and seed the database, then start Morshid with
   the live settings.
3. Complete one database-backed student chat turn.
4. Confirm exactly one additional portal usage event.
5. Confirm the assistant message persisted provider `aws-bedrock`, the selected
   model ID, and prompt version `grounded-completion-v1`.
6. Inspect Git changes and application logs for keys, authorization values,
   prompts, output, or upstream response bodies.
7. Restore `COMPLETION_PROVIDER=deterministic`, clear the diagnostic key, and
   revoke it in the ITI portal.

Key rotation never requires a code change: revoke the old key, replace only
`ITI_BEDROCK_GATEWAY_API_KEY` in the ignored file, and restart the server.

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
document formatting together *are* the persisted document profile
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
uses the *configured* provider, so a migration cannot run alongside it.

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
independently of `EMBEDDING_PROVIDER` — the whole point is to migrate *before*
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
