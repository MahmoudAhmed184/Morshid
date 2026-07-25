# OpenRouter free-provider integration research

Reviewed 2026-07-22 against OpenRouter's official documentation and live public
catalogs. This note records the external API facts and implementation implications
for planning a server-side OpenRouter completion adapter. Model availability,
provider endpoints, privacy flags, and limits are time-sensitive and must be
rechecked before implementation and release.

## Immediate credential action

The API key shared while requesting this research must be treated as compromised.
It was not used during this research and is not recorded here. OpenRouter says that
a suspected exposed key should be deleted and replaced immediately, and documents
rotation as creating a new key, updating applications, then deleting the old key
([OpenRouter authentication](https://openrouter.ai/docs/api/reference/authentication),
[API key rotation](https://openrouter.ai/docs/cookbook/administration/api-key-rotation)).

Only a newly generated key should be supplied to the NestJS server as
`OPENROUTER_API_KEY`, preferably through the deployment secret store. A local
untracked `.env` may be used for development; `.env.example` should contain only an
empty placeholder. The key must never enter client code, committed files, logs,
errors, fixtures, screenshots, or telemetry.

## API contract and server boundary

OpenRouter accepts OpenAI-style Chat Completions at
`POST https://openrouter.ai/api/v1/chat/completions`. Requests use
`Authorization: Bearer <key>` and `Content-Type: application/json`. The OpenAI SDK
can be pointed at `https://openrouter.ai/api/v1`, or the first-party OpenRouter SDK
can be used directly
([OpenRouter quickstart](https://openrouter.ai/docs/quickstart),
[OpenRouter authentication](https://openrouter.ai/docs/api/reference/authentication)).
This fits Morshid's existing provider seam without exposing OpenRouter details to
controllers or the client.

`HTTP-Referer`, `X-OpenRouter-Title`, and `X-OpenRouter-Categories` are optional app
attribution headers; they are not authentication or authorization controls. A
request should set `model` explicitly rather than inherit an account default
([API overview](https://openrouter.ai/docs/api/reference/overview)). The configured
base URL should default to the official HTTPS API origin and, if made configurable
for tests, should be startup-validated rather than accepted from request data.

The integration should start with non-streaming Chat Completions because Morshid's
completion contract currently expects one validated result. Streaming changes the
error contract: after the HTTP `200` is committed, a provider failure arrives as an
in-band SSE error and cannot fail over after partial output
([errors and debugging](https://openrouter.ai/docs/api/reference/errors-and-debugging)).

## Free routing and the dated default-model choice

OpenRouter exposes free access in two distinct forms:

- A specific free variant has an explicit `author/model:free` slug. This preserves
  the model identity while free capacity exists.
- `openrouter/free` analyzes required capabilities and then randomly selects a
  compatible model from the current free pool. The response's `model` field reveals
  the model actually selected.

The random router is documented for experiments, learning, and low-volume use, and
its availability, latency, and behavior vary with its pool. It should therefore not
be Morshid's default: model-dependent prompt quality and regression results would
be difficult to reproduce. It can remain an explicitly configured demo fallback
([Free Models Router](https://openrouter.ai/docs/guides/routing/routers/free-router),
[free model variant](https://openrouter.ai/docs/guides/routing/model-variants/free)).

The recommended default **as of 2026-07-22** is:

```text
OPENROUTER_MODEL=google/gemma-4-26b-a4b-it:free
```

OpenRouter describes this instruction-tuned model as a 25.2-billion-parameter
mixture of experts with only 3.8 billion parameters active per token. Its current
entry exposes a 262K catalog context, function calling, configurable reasoning, and
structured output support. The live endpoint catalog had two zero-priced providers
for this variant on the review date, giving it a better immediate availability
profile than the otherwise attractive 3.6B-active
`openai/gpt-oss-20b:free`, which had one
([Gemma 4 26B A4B free model](https://openrouter.ai/google/gemma-4-26b-a4b-it%3Afree),
[gpt-oss-20b free model](https://openrouter.ai/openai/gpt-oss-20b%3Afree)).
This is a dated operational recommendation, not a permanent architectural default.
Morshid's own input and output budgets must stay far below a catalog context limit,
because endpoint limits and supported parameters can differ.

The unauthenticated `GET /api/v1/models` catalog is the discovery source for model
IDs, price, context, and supported parameters. `GET /api/v1/models/user` is more
useful for deployment checks because it applies the key owner's provider
preferences, privacy settings, and guardrails
([models API](https://openrouter.ai/docs/api/api-reference/models/get-models),
[user-filtered models](https://openrouter.ai/docs/api/api-reference/models/list-models-user)).
A free-model check should require an exact returned ID ending in `:free`, zero prompt
and completion prices, required modalities/parameters, and at least one eligible
endpoint. It must not assume that appending `:free` makes an arbitrary model free.

The live text-model catalog returned these 14 explicit free variants on 2026-07-22:

- `poolside/laguna-s-2.1:free`
- `poolside/laguna-xs-2.1:free`
- `cohere/north-mini-code:free`
- `nvidia/nemotron-3.5-content-safety:free`
- `nvidia/nemotron-3-ultra-550b-a55b:free`
- `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`
- `poolside/laguna-m.1:free`
- `google/gemma-4-26b-a4b-it:free`
- `google/gemma-4-31b-it:free`
- `nvidia/nemotron-3-super-120b-a12b:free`
- `nvidia/nemotron-3-nano-30b-a3b:free`
- `nvidia/nemotron-nano-12b-v2-vl:free`
- `nvidia/nemotron-nano-9b-v2:free`
- `openai/gpt-oss-20b:free`

This snapshot came from the
[live models API](https://openrouter.ai/api/v1/models). Marketing counts and cached
documentation can lag the catalog, so code should consume the API rather than embed
this list.

## Published limits and planning envelopes

OpenRouter's current free-variant limits depend on total credits ever purchased:

| Window | Less than $10 purchased | At least $10 purchased | Meaning |
| --- | ---: | ---: | --- |
| Minute | 20 requests | 20 requests | Published upstream limit |
| Hour | No separate published cap | No separate published cap | At most 1,200 from RPM alone, but the daily remainder also binds |
| Day | 50 requests | 1,000 requests | Published upstream limit |
| Month | No separate published cap | No separate published cap | Daily arithmetic is 1,400-1,550 or 28,000-31,000 for a 28-31 day month |

The hourly and monthly figures are capacity arithmetic, not contractual quotas.
OpenRouter publishes only 20 requests per minute and 50 requests per day for an
account below the $10 lifetime-purchase threshold; the daily limit rises to 1,000
after at least $10 has been purchased, while the minute limit remains 20. Unless
purchase status has been verified independently, planning must assume the 50/day
tier. Additional accounts or keys do not raise the globally governed capacity
([limits](https://openrouter.ai/docs/api/reference/limits),
[FAQ](https://openrouter.ai/docs/faq)).

Credit limits are separate from request-rate limits. A negative account balance can
cause `402` even for a free model, and an optional per-key credit cap can also be
exhausted. `GET /api/v1/key` exposes the key credit limit and remaining credits plus
daily, weekly, and monthly **credit usage**. Its `rate_limit` field is deprecated and
must not be used as the quota source
([limits](https://openrouter.ai/docs/api/reference/limits)).

Morshid should enforce conservative, environment-configurable local ceilings below
the upstream limits with atomic Redis counters shared by all API replicas. The
local policy should cover rolling minute, hour, day, and month windows, per-user
fairness, a small concurrency bound, and reserved capacity for retries. The upstream
defaults should still be code constants with startup validation; environment values
may lower them but should not silently claim more upstream capacity. This local
limiter is an implementation recommendation derived from the published limits, not
an OpenRouter requirement.

Successful inference responses do not carry remaining-quota headers. When
OpenRouter itself returns a platform `429`, the error may include
`X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. `Retry-After`
may also be present. Quota monitoring must therefore use local counters and periodic
`GET /api/v1/key` checks instead of expecting headers on every response
([limits](https://openrouter.ai/docs/api/reference/limits)).

## Privacy boundary for student and course content

OpenRouter says it does not store prompt or response content unless the account opts
into private input/output logging or use of inputs/outputs. It does retain request
metadata such as token counts and latency. Upstream model providers have independent
retention and training policies, and OpenRouter exposes separate account controls
for paid and free providers
([data collection](https://openrouter.ai/docs/guides/privacy/data-collection),
[provider logging](https://openrouter.ai/docs/guides/privacy/provider-logging/)).

The request can set `provider.data_collection` to `deny` to exclude providers that
may collect user data, and `provider.zdr` to `true` to require an endpoint that stores
no data. These constraints can eliminate every provider, which must fail closed
rather than be silently relaxed
([provider selection](https://openrouter.ai/docs/guides/routing/provider-selection),
[Zero Data Retention](https://openrouter.ai/docs/guides/features/zdr)).

The live [ZDR endpoint catalog](https://openrouter.ai/api/v1/endpoints/zdr) contained
**no zero-priced text endpoint on 2026-07-22**. Therefore strict ZDR and free text
inference were not compatible on the review date. Free inference must not receive
student-identifying, confidential, licensed, or private course content unless the
project has explicitly accepted the current provider policies. The safe options are
to de-identify and minimize the transmitted data, disable live completion for that
content, or configure an eligible paid ZDR endpoint. A privacy filter must never
fall back from ZDR to a free non-ZDR provider just to produce an answer.

OpenRouter's optional input/output logging should remain disabled. If enabled, its
documentation says stored content is retained for at least three months and may be
kept longer unless deletion is requested
([input/output logging](https://openrouter.ai/docs/guides/features/input-output-logging)).

## Errors, retries, fallbacks, and observability

OpenRouter provides stable typed error metadata. Relevant categories include
`authentication` (`401`), `payment_required` (`402`), `permission_denied` (`403`),
`rate_limit_exceeded` (`429`), `provider_unavailable` (`502`),
`provider_overloaded` (`503`), and `timeout` (`504`). Code should branch on the
documented `error_type`, not provider message text. It should not retry validation,
authentication, payment, permission, or moderation failures
([errors and debugging](https://openrouter.ai/docs/api/reference/errors-and-debugging)).

For a retryable `429` or `503`, honor a valid `Retry-After`; otherwise use capped
exponential backoff with jitter and a small total-attempt bound. A local retry is a
new request and consumes scarce free capacity, while OpenRouter may already have
tried other endpoints internally. If model fallbacks are configured, every allowed
fallback must explicitly end in `:free`; an unqualified or paid model must never be
introduced without deliberate spend authorization
([model fallbacks](https://openrouter.ai/docs/guides/routing/model-fallbacks)).

Every completion response includes usage details. The generation ID can later query
`GET /api/v1/generation` for model, provider, tokens, cost, timing, and request
metadata. `X-OpenRouter-Metadata: enabled` can additionally expose routing and
fallback decisions; its response shape is additive, so clients must ignore unknown
fields
([usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting),
[generation metadata](https://openrouter.ai/docs/api/api-reference/generations/get-generation),
[router metadata](https://openrouter.ai/docs/guides/features/router-metadata)).

Morshid telemetry should capture only content-free operational fields: its own
attempt ID, OpenRouter generation/request ID, requested model, returned model,
provider when available, token counts, cost, latency, finish reason, HTTP/error type,
retry count, fallback count, and rolling request totals for minute/hour/day/month.
It must never record the authorization header, API key, prepared messages, student
question, retrieved chunks, model answer, raw upstream error, or debug payload.
OpenRouter's production debug echo should remain disabled because it can return the
transformed upstream request body.

## Pre-implementation verification checklist

Immediately before implementation and again before release:

1. Rotate the exposed credential and configure only the replacement through the
   server's secret channel.
2. Re-read the official limits page and keep the local limiter below the current
   upstream minute/day values.
3. Query `/api/v1/models/user` with the replacement key and verify the configured
   model exists, is still free, supports the required parameters, and is permitted
   by the account's privacy settings.
4. Query endpoint/ZDR metadata and confirm the accepted data policy. Treat no
   eligible provider as a readiness failure, never as permission to weaken policy.
5. Run focused evaluation in Arabic and English against Morshid's grounded-answer
   contract; a small context and zero price do not establish answer quality.
6. Test `401`, `402`, `403`, `408`, `429`, `502`, `503`, timeout, cancellation,
   malformed success, missing usage, and retry exhaustion without making errors or
   logs content-bearing.

## Primary sources used

- [OpenRouter quickstart](https://openrouter.ai/docs/quickstart)
- [OpenRouter authentication](https://openrouter.ai/docs/api/reference/authentication)
- [API key rotation](https://openrouter.ai/docs/cookbook/administration/api-key-rotation)
- [API overview](https://openrouter.ai/docs/api/reference/overview)
- [Free Models Router](https://openrouter.ai/docs/guides/routing/routers/free-router)
- [Free model variant](https://openrouter.ai/docs/guides/routing/model-variants/free)
- [Models API](https://openrouter.ai/docs/api/api-reference/models/get-models)
- [User-filtered models API](https://openrouter.ai/docs/api/api-reference/models/list-models-user)
- [OpenRouter limits](https://openrouter.ai/docs/api/reference/limits)
- [OpenRouter FAQ](https://openrouter.ai/docs/faq)
- [Errors and debugging](https://openrouter.ai/docs/api/reference/errors-and-debugging)
- [Model fallbacks](https://openrouter.ai/docs/guides/routing/model-fallbacks)
- [Provider selection](https://openrouter.ai/docs/guides/routing/provider-selection)
- [Data collection](https://openrouter.ai/docs/guides/privacy/data-collection)
- [Provider logging](https://openrouter.ai/docs/guides/privacy/provider-logging/)
- [Zero Data Retention](https://openrouter.ai/docs/guides/features/zdr)
- [Input/output logging](https://openrouter.ai/docs/guides/features/input-output-logging)
- [Usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting)
- [Generation metadata API](https://openrouter.ai/docs/api/api-reference/generations/get-generation)
- [Router metadata](https://openrouter.ai/docs/guides/features/router-metadata)
- [Gemma 4 26B A4B free model](https://openrouter.ai/google/gemma-4-26b-a4b-it%3Afree)
- [gpt-oss-20b free model](https://openrouter.ai/openai/gpt-oss-20b%3Afree)
- [Live models catalog](https://openrouter.ai/api/v1/models)
- [Live ZDR endpoint catalog](https://openrouter.ai/api/v1/endpoints/zdr)
