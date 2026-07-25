# AWS Bedrock through the ITI gateway research

Reviewed 2026-07-24 for PR
[#120](https://github.com/MahmoudAhmed184/Morshid/pull/120). This note records
the primary-source basis for Morshid's `aws-bedrock` completion adapter and the
state of model qualification on that date. ITI is the network and credential
boundary; Morshid does not call AWS directly.

The operator-facing configuration, startup-validation rules, and live-test
runbook that these findings justify live in
[`server/README.md`](../server/README.md), under "AWS Bedrock completion through
ITI".

## ITI's published integration contract

The public
[ITI Student Bedrock Gateway integration page](http://apiaccess.iti.net.eg/student/integration)
documents chat as `POST /api/v1/student/chat`. Its example JSON contains
`model_id`, a `messages` array of role/content objects, `system_prompt`, and
`max_tokens`, and it sends JSON with `Content-Type: application/json`. The page
places the student key in `Authorization: Bearer ...`; no key belongs in the
URL, request body, model metadata, or source code.

The same ITI page says that the key calls the gateway rather than AWS and that
the gateway checks student policy, the allowed model, budget, and usage before
invoking Bedrock. It also directs students to replace example model IDs with
models approved on their own dashboard. The adapter must therefore send the
locally selected, allow-listed model to ITI and must not infer account policy,
budget, usage, region, or model eligibility itself
([ITI integration contract](http://apiaccess.iti.net.eg/student/integration)).
Those account and usage endpoints are not part of the documented runtime chat
contract and are excluded from the adapter.

On 2026-07-24, an unauthenticated, bodyless retrieval from this environment
returned HTTP 200 for the
[HTTP integration page](http://apiaccess.iti.net.eg/student/integration), while
a connection to the corresponding
[HTTPS integration page](https://apiaccess.iti.net.eg/student/integration)
timed out before an HTTP response after a five-second connection deadline. This
is a dated reachability observation from one environment, not evidence that
HTTPS is universally unavailable. No bearer key was read or transmitted for
either observation, and no chat endpoint was called.

## Bedrock model documentation and retry policy

AWS lists `gpt-oss-20b` as an active, text-generation and coding model launched
on 2025-08-05
([AWS `gpt-oss-20b` model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-openai-gpt-oss-20b.html)).
AWS's Bedrock OpenAI-model reference gives its exact Bedrock model ID as
`openai.gpt-oss-20b-1:0`, describes text input and output, and lists a
128,000-token context window
([AWS OpenAI model parameters](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-openai.html)).
That documentation establishes a candidate identifier; it does not establish
that a particular ITI student account currently permits the model.

AWS recommends exponential backoff with random jitter for Bedrock internal
failures and throttling responses
([AWS Bedrock API error guidance](https://docs.aws.amazon.com/bedrock/latest/userguide/troubleshooting-api-error-codes.html)).
AWS's broader retry guidance also says callers should decide whether an error is
retryable, cap attempts, and avoid retrying non-idempotent operations
([AWS Well-Architected retry guidance](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_mitigate_interaction_failure_limit_retries.html)).
The ITI contract does not document chat idempotency or an idempotency key
([ITI integration contract](http://apiaccess.iti.net.eg/student/integration)).
Morshid consequently makes exactly one gateway `POST`: it neither assumes that
an ambiguous failure is safe to replay nor inherits an SDK retry policy. This is
a deliberate integration constraint, not a claim that AWS generally discourages
retries.

## Node.js 24 transport primitives

Node.js 24 provides a stable, browser-compatible global `fetch()` implemented
on Undici
([Node.js v24.16.0 `fetch`](https://nodejs.org/download/release/v24.16.0/docs/api/globals.html#fetch)).
It also provides `AbortSignal.timeout(delay)` and
`AbortSignal.any(signals)`; the latter aborts when any input aborts and adopts
the initiating signal's reason
([Node.js v24.16.0 `AbortSignal`](https://nodejs.org/download/release/v24.16.0/docs/api/globals.html#class-abortsignal)).
Those primitives support one request governed by both the caller's cancellation
signal and Morshid's timeout without adding the AWS SDK or a retrying client.
Because an abort reason may be application-controlled, it is classified locally
rather than copied into a public error.

The Fetch standard defines request redirect modes `follow`, `error`, and
`manual`; `error` returns a network error when a redirect is encountered
([WHATWG Fetch request redirect mode](https://fetch.spec.whatwg.org/#concept-request-redirect-mode)).
The adapter uses that mode so a bearer-authenticated request is not resent to a
redirect target. Node's Web Streams API exposes response bodies as
`ReadableStream` instances
([Node.js v24.16.0 Web Streams](https://nodejs.org/download/release/v24.16.0/docs/api/webstreams.html#class-readablestream)).
Reading incrementally is therefore the enforceable boundary for the local
response-size cap; parsing an unbounded convenience body first would apply the
limit too late. The cap is 256 KiB: it is derived from Morshid's own
16,000-code-point output limit at up to four UTF-8 bytes per code point, so an
answer that is legitimately at the product's maximum length — Arabic text costs
two bytes per code point and emoji four — is not rejected as a provider
failure.

## NestJS generation, registration, and configuration

The Nest CLI lists `provider` (`pr`) as the schematic for generating a provider,
defines `--dry-run` as reporting proposed filesystem changes without making
them, and documents `--spec` for test generation with a default of `true`
([Nest CLI `generate`](https://docs.nestjs.com/cli/usages#nest-generate)).
That is the basis for first previewing and then generating the colocated gateway
adapter boilerplate before adapting it to the repository's provider contract.

Nest custom providers support runtime string or `Symbol` tokens for TypeScript
interfaces, dynamic `useFactory` construction, dependency injection into the
factory, and export by provider token
([NestJS custom providers](https://docs.nestjs.com/fundamentals/custom-providers)).
Those facilities allow one public `CompletionProvider` token to resolve to
either the deterministic internal adapter or the configured AWS Bedrock
adapter, while keeping implementation classes private to the completion module.

Nest configuration supports a synchronous custom `validate()` function that can
transform environment input and fail application bootstrap by throwing. Its
documentation also notes that custom configuration files are not automatically
validated
([NestJS configuration validation](https://docs.nestjs.com/techniques/configuration#custom-validate-function)).
Provider choice, URL policy, key presence, selected model, local model
allow-list membership, timeout, and output-token bounds therefore belong in
startup validation rather than being discovered by the first student request.

## Bearer-token and TLS security boundary

RFC 6750 defines bearer possession as sufficient to use a token, recommends the
HTTP `Authorization` header, requires TLS for bearer-token use, and warns against
putting bearer tokens in page URLs because URLs are likely to be logged
([RFC 6750 sections 2 and 5](https://www.rfc-editor.org/rfc/rfc6750.html)).
The gateway key is consequently header-only, held in local secret
configuration, and excluded from errors, logs, serialized results, and committed
examples.

OWASP states that TLS supplies confidentiality, integrity, and server
authentication, recommends TLS for all pages, and specifically says API-only
endpoints should disable HTTP rather than redirect it
([OWASP Transport Layer Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)).
OWASP's secure-coding checklist also says failed TLS connections must not fall
back to insecure transport
([OWASP secure communication checklist](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/stable-en/02-checklist/05-checklist)).
Accordingly, HTTPS is the normal deployment transport. The temporary HTTP path
is an explicit development-only exception for the exact ITI host and base path;
it is rejected in production and is never an automatic downgrade after an
HTTPS failure. A request in explicitly selected HTTP mode is still one request
to that configured URL, accompanied only by a fixed credential-free warning.

## Model qualification record

### Prior non-exhaustive diagnostics (2026-07-23)

The pre-existing PR record says a prior diagnostic retrieved 26 approved model
IDs, but it did not probe every approved model. It records the following safe,
redacted observations
([PR #120, Live Verification](https://github.com/MahmoudAhmed184/Morshid/pull/120)):

| Model or set | Prior safe result | Output length | Usage event |
| --- | --- | ---: | --- |
| Approved account set (26 IDs; list omitted) | Enumerated only; not exhaustively probed | Not observed | Not observed |
| `openai.gpt-oss-20b-1:0` | HTTP 200, blank result at `max_tokens=16` | 0 | Present |
| `openai.gpt-oss-20b-1:0` | Later HTTP 200, nonblank result at `max_tokens=128` | Redacted | Present |
| Claude Haiku 4.5 (exact ID omitted) | Gateway `BEDROCK_ERROR` | Not observed | Not reported |
| `us.amazon.nova-2-lite-v1:0` | Gateway `REGION_NOT_ALLOWED` | Not observed | Not reported |
| ITI page's Claude 3 Haiku example | Rejected as not allowed for the account | Not observed | Not reported |

This table preserves only model identity where already documented, safe status,
whether output was blank, and usage-event presence. It contains no prompt,
output text, key, authorization value, header, or upstream response body. These
rows are historical, non-exhaustive evidence only; they do not satisfy the
planned one-probe-per-approved-model qualification.

### Current required compatibility matrix (2026-07-24)

| Approved model ID | Safe status | Latency | Output length | Usage event |
| --- | --- | ---: | ---: | --- |
| `amazon.nova-2-multimodal-embeddings-v1:0` | HTTP failure | 1,598 ms | Not observed | No |
| `amazon.nova-2-sonic-v1:0` | HTTP failure | 3,789 ms | Not observed | No |
| `amazon.nova-reel-v1:1` | HTTP failure | 3,483 ms | Not observed | No |
| `amazon.titan-embed-image-v1` | HTTP failure | 3,500 ms | Not observed | No |
| `amazon.titan-embed-text-v2:0:8k` | HTTP failure | 1,414 ms | Not observed | No |
| `amazon.titan-image-generator-v2:0` | HTTP failure | 1,407 ms | Not observed | No |
| `anthropic.claude-haiku-4-5-20251001-v1:0` | HTTP failure | 1,490 ms | Not observed | No |
| `anthropic.claude-opus-4-7` | HTTP failure | 1,477 ms | Not observed | No |
| `anthropic.claude-sonnet-4-6` | HTTP failure | 1,501 ms | Not observed | No |
| `deepseek.r1-v1:0` | Nonblank success | 2,669 ms | 144 | Yes |
| `deepseek.v3.2` | Nonblank success | 2,227 ms | 87 | Yes |
| `global.amazon.nova-2-lite-v1:0` | HTTP failure | 2,902 ms | Not observed | No |
| `global.twelvelabs.pegasus-1-2-v1:0` | HTTP failure | 3,529 ms | Not observed | No |
| `meta.llama4-scout-17b-instruct-v1:0` | Nonblank success | 1,777 ms | 205 | Yes |
| `mistral.pixtral-large-2502-v1:0` | Nonblank success | 1,981 ms | 138 | Yes |
| `mistral.voxtral-small-24b-2507` | Nonblank success | 1,869 ms | 80 | Yes |
| `openai.gpt-oss-120b-1:0` | Nonblank success | 2,195 ms | 147 | Yes |
| `openai.gpt-oss-20b-1:0` | Nonblank success | 2,261 ms | 127 | Yes |
| `openai.gpt-oss-safeguard-120b` | Nonblank success | 2,696 ms | 166 | Yes |
| `openai.gpt-oss-safeguard-20b` | Nonblank success | 2,836 ms | 161 | Yes |
| `qwen.qwen3-vl-235b-a22b` | Nonblank success | 2,303 ms | 113 | Yes |
| `stability.stable-fast-upscale-v1:0` | HTTP failure | 3,302 ms | Not observed | No |
| `stability.stable-image-inpaint-v1:0` | HTTP failure | 3,302 ms | Not observed | No |
| `stability.stable-image-remove-background-v1:0` | HTTP failure | 3,251 ms | Not observed | No |
| `stability.stable-image-search-recolor-v1:0` | HTTP failure | 3,085 ms | Not observed | No |
| `stability.stable-image-search-replace-v1:0` | HTTP failure | 3,149 ms | Not observed | No |
| `stability.stable-outpaint-v1:0` | HTTP failure | 3,291 ms | Not observed | No |
| `us.amazon.nova-2-lite-v1:0` | HTTP failure | 3,321 ms | Not observed | No |
| `us.cohere.embed-v4:0` | HTTP failure | 3,263 ms | Not observed | No |
| `us.meta.llama3-3-70b-instruct-v1:0` | Nonblank success | 1,812 ms | 203 | Yes |
| `us.mistral.pixtral-large-2502-v1:0` | Nonblank success | 2,740 ms | 449 | Yes |
| `us.twelvelabs.marengo-embed-3-0-v1:0` | HTTP failure | 3,303 ms | Not observed | No |

At the user's explicit direction, the current ignored local key was used for
this dated diagnostic over the explicitly enabled development-only HTTP
transport. The key, authorization header, synthetic prompts, output text, and
upstream bodies were not recorded. The account returned 32 approved model IDs;
each was probed sequentially exactly once with `max_tokens=256`, without retry
or fallback. The run produced 12 nonblank successes and 20 HTTP failures, with
no blank successes, network failures, or indeterminate results. Gateway usage
events increased from 2 to 14, exactly matching the 12 successful probes.

The ignored local allow-list was populated with the 12 successful IDs. A single
database-backed Morshid student chat then used
`openai.gpt-oss-20b-1:0`. It completed with retrieval evidence and persisted
trusted local metadata `provider=aws-bedrock`,
`model=openai.gpt-oss-20b-1:0`, and
`promptVersion=grounded-completion-v1`; input and output token counts remained
absent. The gateway usage-event count increased once more, from 14 to 15. The
server was stopped and the ignored local provider and transport settings were
restored to deterministic and HTTPS after verification.

## Primary sources

The ITI links below are cited over `http://` on purpose, and the `http://` form
is not a typo or a recommendation: as recorded under "ITI's published
integration contract" above, the HTTPS integration page did not answer from this
environment on 2026-07-24 while the plaintext page returned HTTP 200, so the
plaintext URL is what was actually read. Morshid itself still deploys over
HTTPS, and its plaintext transport is a development-only, explicitly enabled
exception.

- [ITI Student Bedrock Gateway integration contract](http://apiaccess.iti.net.eg/student/integration)
- [AWS `gpt-oss-20b` model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-openai-gpt-oss-20b.html)
- [AWS OpenAI model parameters](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-openai.html)
- [AWS Bedrock API error guidance](https://docs.aws.amazon.com/bedrock/latest/userguide/troubleshooting-api-error-codes.html)
- [AWS Well-Architected retry guidance](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_mitigate_interaction_failure_limit_retries.html)
- [Node.js v24.16.0 global API documentation](https://nodejs.org/download/release/v24.16.0/docs/api/globals.html)
- [Node.js v24.16.0 Web Streams documentation](https://nodejs.org/download/release/v24.16.0/docs/api/webstreams.html)
- [WHATWG Fetch standard](https://fetch.spec.whatwg.org/)
- [Nest CLI usage](https://docs.nestjs.com/cli/usages)
- [NestJS custom providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [NestJS configuration](https://docs.nestjs.com/techniques/configuration)
- [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750.html)
- [OWASP Transport Layer Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html)
- [OWASP secure communication checklist](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/stable-en/02-checklist/05-checklist)
- [PR #120 historical diagnostic record](https://github.com/MahmoudAhmed184/Morshid/pull/120)
