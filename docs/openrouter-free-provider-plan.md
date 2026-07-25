# OpenRouter free completion provider plan

Status: proposed  
Reviewed against OpenRouter's public API and model catalog on 2026-07-22.

## Decision summary

| Decision | Proposed choice |
| --- | --- |
| Production adapter | Add `openrouter` behind the existing `CompletionProvider` interface. |
| Default OpenRouter model | `openai/gpt-oss-20b:free` |
| Why this model | It is a small general-purpose MoE model (21B total, 3.6B active), has a 131K context window, supports structured outputs, and is currently present in OpenRouter's free, ZDR-eligible catalog. |
| Source-code default | Keep `COMPLETION_PROVIDER=deterministic` so fresh checkouts, tests, and CI remain keyless and offline. A deployed environment opts in with `COMPLETION_PROVIDER=openrouter`. |
| Model selection | Configure `OPENROUTER_MODEL` in the server environment; accept only a `:free` model or `openrouter/free` in this phase. |
| Transport | Use Node 24's native `fetch` against a fixed OpenRouter URL. Do not add an SDK or make the credential destination configurable. |
| Privacy posture | Require per-request ZDR and deny provider data collection. Keep OpenRouter's own prompt logging and model-training opt-ins disabled. |
| Retry posture | One application request per Student attempt. Let OpenRouter try alternate endpoints for the same model, but do not add an invisible application retry loop on the 50-request/day tier. |
| Offline fallback | Keep the deterministic adapter as an explicit deployment/demo mode, not an automatic fallback after a live-provider failure. |

The API key pasted in the planning request must be revoked before any implementation or smoke test. It must never be copied into a repository file, issue, log, command, test fixture, screenshot, or plan.

## July 2026 provider constraints

OpenRouter currently documents these account-wide free-model limits:

| Account state | Provider limit/minute | Provider limit/day |
| --- | ---: | ---: |
| Less than $10 purchased over the account's lifetime | 20 | 50 |
| At least $10 purchased over the account's lifetime | 20 | 1,000 |

Creating more keys or accounts is not a supported way to expand capacity. The limits page says capacity is governed globally, and successful responses do not include remaining-rate-limit headers. On an OpenRouter platform `429`, the response may include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`; `Retry-After` is present when all attempted providers return a retry hint. See [OpenRouter limits](https://openrouter.ai/docs/api_reference/limits).

OpenRouter does **not** publish free-model request limits per hour or per month. Morshid therefore needs to label hour/month values as local operating budgets, not OpenRouter facts.

Free model availability changes frequently. `openrouter/free` randomly chooses among eligible free models, while a specific `:free` slug pins the model family. The specific model is the safer default for Morshid's golden-dataset evaluation and tutoring-policy tests; the free router remains a valid environment override for experimentation. See [Free Models Router](https://openrouter.ai/docs/guides/routing/routers/free-router) and [free variants](https://openrouter.ai/docs/guides/routing/model-variants/free).

The selected default is described by OpenRouter as an open-weight 21B MoE model with 3.6B active parameters per forward pass and a 131K context window. See [`openai/gpt-oss-20b:free`](https://openrouter.ai/openai/gpt-oss-20b%3Afree).

## Module and seam design

The existing completion module is already the correct deep module. Its external interface remains:

```text
GroundedChatService
        |
        v
CompletionProvider.complete(grounded request)
        |
        v
ValidatedCompletionProvider
        |
        +--> deterministic adapter (offline/test/backup)
        |
        +--> OpenRouter quota gate --> OpenRouter adapter --> fixed HTTPS endpoint
```

Adding OpenRouter makes the internal adapter seam real: the deterministic and OpenRouter adapters both receive only prepared, escaped messages plus an abort signal. Retrieval, authorization, citation construction, persistence, and Student identity stay outside the adapter. OpenRouter-specific request fields, response validation, quota accounting, and error translation stay inside the completion module.

Do not add `studentId`, `courseId`, raw Prisma records, or environment access to `CompletionProvider.complete()`. Per-Student fairness limits belong at the grounded-chat orchestration seam in a later usage-policy task; the provider-account limits in this plan are global because OpenRouter enforces them globally.

## Configuration contract

Add the following server-only variables to the validated environment schema and `server/.env.example`:

| Variable | Proposed default | Validation and role |
| --- | --- | --- |
| `COMPLETION_PROVIDER` | `deterministic` | Extend the enum to `deterministic | openrouter`. Deployments explicitly select `openrouter`. |
| `COMPLETION_TIMEOUT_MS` | `30000` | Keep the existing positive integer and 120-second ceiling. |
| `OPENROUTER_API_KEY` | none | Required only when `COMPLETION_PROVIDER=openrouter`; reject blank values and committed placeholder text. Treat as a secret. |
| `OPENROUTER_MODEL` | `openai/gpt-oss-20b:free` | Bounded string; in this phase require a `:free` suffix or the exact `openrouter/free` router slug. |
| `OPENROUTER_MAX_OUTPUT_TOKENS` | `800` | Integer, proposed range 64-2,048. This bounds latency and output even though free requests have zero token price. |
| `OPENROUTER_REQUEST_LIMIT_PER_MINUTE` | `10` | Local global cap; must not exceed the published 20 RPM. |
| `OPENROUTER_REQUEST_LIMIT_PER_HOUR` | `20` | Local smoothing budget; OpenRouter publishes no hourly cap. |
| `OPENROUTER_REQUEST_LIMIT_PER_DAY` | `45` | Leaves headroom below the 50/day account tier. Raise only after confirming the account qualifies for 1,000/day. |
| `OPENROUTER_REQUEST_LIMIT_PER_MONTH` | `1000` | Local calendar-month operating budget; OpenRouter publishes no monthly request cap. |

Validate that minute <= hour <= day <= month. A production OpenRouter configuration must fail at startup if its key is missing, its model is not free, or any limit is unsafe. A deterministic configuration must not require OpenRouter variables.

Do not expose `OPENROUTER_BASE_URL`. Hard-code `https://openrouter.ai/api/v1/chat/completions` so a configuration mistake cannot send the bearer token to an attacker-controlled host. `X-OpenRouter-Title: Morshid` can be fixed in code; use the already validated public origin for `HTTP-Referer` only when it is an HTTPS production URL.

The committed examples contain placeholders only. Local development uses the git-ignored `server/.env`; hosted environments use their secret manager. Docker Compose passes through the secret without a default and must still allow deterministic infrastructure/test startup without it.

## OpenRouter request and response contract

The adapter sends one non-streaming `POST` to the fixed chat-completions endpoint with:

- `Authorization: Bearer ...`, `Content-Type: application/json`, and optional app attribution headers;
- the configured free model and the two prepared `system`/`user` messages it receives from the existing validated provider;
- `stream: false`, `max_tokens: 800`, and a low-variance temperature suitable for evaluated tutoring responses;
- `reasoning: { effort: 'low', exclude: true }` for the proposed default, keeping hidden reasoning out of the response;
- `provider: { zdr: true, data_collection: 'deny', require_parameters: true, allow_fallbacks: true }`.

Per-request ZDR restricts routing to endpoints that do not retain prompts. `data_collection: 'deny'` excludes providers that may collect prompt data. OpenRouter documents both controls in [provider routing](https://openrouter.ai/docs/guides/routing/provider-selection) and explains that its own prompt/response logging is opt-in in [data collection](https://openrouter.ai/docs/guides/privacy/data-collection).

The adapter must:

1. pass the existing composed abort signal to `fetch`;
2. reject an oversized response before parsing (bounded `Content-Length` plus a bounded streamed-body read, proposed ceiling 1 MiB);
3. parse JSON as `unknown` and validate only the required response fields with Zod;
4. require one nonblank text completion, a bounded actual `model` string, and safe non-negative token counts;
5. return `provider: 'openrouter'`, the **actual** response model, the existing prompt version, and mapped prompt/completion token counts;
6. ignore reasoning text and all unneeded upstream metadata;
7. never retain or log the authorization header, messages, response content, raw error body, or provider exception.

Keep the existing provider-independent code-point budgets. The current maximum grounded context is well below the selected model's advertised context, and the OpenRouter adapter may impose a smaller internal byte/token safety ceiling later without widening the public interface.

## Rate-limit and usage-budget design

Create an internal `OpenRouterQuotaGate` backed by Redis. It runs immediately before `fetch` and reserves one request across all configured windows atomically.

- Use a token-bucket or GCRA-style limit for minute/hour smoothing.
- Use UTC-aligned counters for day/month to match OpenRouter's UTC usage reporting.
- Use one Lua script so concurrent Nest instances either reserve every window or none of them.
- Give every key a TTL through the end of its window plus a small cleanup buffer.
- Count an attempted outbound request even if it times out or fails; do not refund it.
- Fail closed when Redis is unavailable: preserve the Student message and do not make an uncontrolled provider request.
- When OpenRouter returns `429`, parse only bounded numeric/reset headers and set a short global cooldown. Do not automatically retry that Student attempt.

The initial local defaults deliberately preserve capacity for health investigation and manual retries:

```text
10/minute -> 20/hour -> 45/day -> 1,000/month
```

These values are global across all Students and app instances sharing the OpenRouter account. They make the unfunded free tier suitable for a controlled demo, not a classroom-scale production workload. If the account has purchased at least $10, operators may raise the local day/month budgets after updating the runbook; the 20 RPM upstream ceiling remains unchanged.

Do not call a completion from a readiness probe. An explicit operator smoke test may query key/model metadata and send one synthetic, non-sensitive prompt, but it must never run in CI or on every boot.

## Error and retry behavior

Extend the fixed completion error model with `COMPLETION_USAGE_LIMIT_REACHED`. Only trusted local code may produce it:

- the Redis gate produces it before an outbound request when a local window is exhausted;
- the OpenRouter adapter maps a validated `429` to it;
- the validated wrapper preserves that fixed code while continuing to discard raw causes and arbitrary adapter errors.

Map it in grounded-chat orchestration to a distinct persisted terminal code such as `GROUNDING_USAGE_LIMIT_REACHED` and clear copy such as “AI usage is temporarily limited. Please try again later.” All other auth, payment, malformed-response, network, and upstream failures continue through the generic safe provider-failure path, with an operator metric distinguishing their internal category.

Do not automatically switch to the deterministic adapter after a live failure. That would silently change product behavior and could return an evidence digest when the Student expected generated guidance. The existing explicit retry path preserves the Student message and is the right recovery interface.

## Security and privacy gates

Before enabling the provider in any shared environment:

1. Revoke the exposed key and create a least-privilege replacement key with a hard OpenRouter key budget where available.
2. Keep OpenRouter private input/output logging and “use inputs/outputs” disabled.
3. Enable account/guardrail ZDR for non-frontier models as defense in depth, in addition to `provider.zdr: true` on every request.
4. Confirm that the selected free model still has at least one ZDR endpoint. If not, fail closed rather than relaxing privacy routing.
5. Treat OpenRouter and the selected host as external processors. Do not send credentials, direct identifiers, private student records, or course material that is not approved for external processing.
6. Restrict the initial rollout to the approved demo dataset and synthetic/test Student prompts until privacy and course-content reviews are complete.
7. Document that free models have low limits, changing availability, and no production reliability commitment. A paid/ZDR model or self-hosted model is required before promising classroom-scale service.

## Observability

Emit content-free structured metrics/logs for:

- attempts, successes, local limit denials, upstream `429`, timeouts, invalid responses, and other provider failures;
- model requested versus actual model returned;
- latency and safe prompt/completion token counts;
- local remaining day/month capacity and the limiting window;
- response status class and a bounded provider request/generation identifier, if available.

Never use model, status, or provider strings from an unvalidated response as unrestricted metric labels. Never log prompts, retrieved chunks, completions, secrets, raw upstream bodies, or abort reasons. The existing database fields already persist provider, actual model, prompt version, and optional token counts on successful assistant messages.

## Implementation sequence

### 1. Secure configuration

- Rotate the exposed key.
- Extend `env.schema.ts` with conditional OpenRouter validation and focused tests.
- Update `server/.env.example`, root Compose pass-through, and deployment docs without adding a real key.
- Keep deterministic as the code/CI default and set OpenRouter only in the intended runtime environment.

### 2. External adapter

- Add `openrouter-completion.adapter.ts` and a small response-schema/helper file under `server/src/modules/completion/`.
- Inject a fetch-compatible function in tests; production uses the native global implementation.
- Construct only the request described above and map only validated result fields.
- Extend the exhaustive factory and Nest module wiring without changing callers.

### 3. Global quota gate

- Import the existing Redis module into the completion module.
- Add the atomic four-window quota script and a test adapter for the gate.
- Reserve before `fetch`, fail closed on Redis errors, and turn upstream reset hints into a bounded cooldown.

### 4. Safe limit outcome

- Add the fixed completion usage-limit code.
- Preserve only that trusted adapter/gate outcome through the validation wrapper.
- Map it to distinct grounded-chat terminal content/code and an audit event; retain generic public handling for all other failures.

### 5. Verification

- Unit-test exact outbound URL, headers, body, ZDR/data settings, model override, abort propagation, result/token mapping, bounded body reads, every relevant HTTP class, and secret/error-body non-disclosure.
- Unit-test configuration conditionality, free-only model validation, limit ordering, and exhaustive factory selection.
- Integration-test Redis concurrency, all four windows, UTC resets, expiry, upstream cooldown, and fail-closed behavior.
- Keep service/E2E tests network-free by overriding the completion provider or injected fetch.
- Run `npm run check`; then run one explicit non-sensitive OpenRouter smoke test outside CI with the rotated key.
- Evaluate the live model against the locked golden dataset before changing any shared deployment from deterministic to OpenRouter.

## Expected files

- `server/src/modules/config/env.schema.ts` and its spec
- `server/src/modules/completion/openrouter-completion.adapter.ts` and specs
- `server/src/modules/completion/openrouter-quota.gate.ts` and integration specs
- completion provider/factory/module files and specs
- grounded-chat constants/orchestration tests for the limit outcome
- `server/.env.example`
- `docker-compose.yml`
- completion security notes, model decision notes, and deployment/runbook documentation

No Prisma migration is required for the provider itself: successful messages already store provider, actual model, prompt version, and token counts. A later product-wide per-Student fairness policy may add Redis keys and audit behavior but should not widen the completion-provider interface.

## Acceptance criteria

- Selecting `openrouter` with no valid key fails startup; selecting `deterministic` remains keyless and network-free.
- The default OpenRouter request targets `openai/gpt-oss-20b:free`, and changing `OPENROUTER_MODEL` changes the requested free model without code changes.
- Paid model slugs and attacker-controlled base URLs cannot be enabled accidentally.
- Every request enforces ZDR and denies data collection; no code path silently relaxes either control.
- Redis prevents the configured minute, hour, day, and month budgets from being exceeded under concurrency and fails closed when unavailable.
- A local denial makes no OpenRouter call; `429` is surfaced as a safe usage-limit outcome; no automatic retry burns another free request.
- Successful responses persist `openrouter`, the actual model, prompt version, and validated token counts.
- Prompts, retrieved course chunks, completions, keys, and raw provider errors never appear in logs or public errors.
- CI and normal tests perform no external AI calls, and the full repository check passes.

## Explicit non-goals for the first change

- streaming responses;
- OpenRouter embeddings;
- paid-model or cross-model automatic fallback;
- a client-side model picker;
- dynamic model discovery on every request;
- classroom-scale capacity on the free tier;
- per-Student fairness limits inside the completion module.
