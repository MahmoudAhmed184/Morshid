# Completion provider security notes

Reviewed 2026-07-21 for issue #87. These notes document the security rationale
for the server-side completion-provider seam; they are not a security assessment
of the complete RAG pipeline.

## Trust boundary and prompt envelope

The student question, source titles, chunk indices, and retrieved chunk content
are all dynamic data and must be treated as untrusted. OWASP AISVS 1.0 requires
normalization, mitigation of encoding or representation smuggling, an instruction
hierarchy in which system and developer instructions override untrusted input, and
literal encoding of reserved special tokens
([AISVS C2.1.1, C2.1.2, C2.1.6, and C2.1.7](https://github.com/OWASP/AISVS/blob/main/1.0/en/0x10-C02-Input-Validation.md#c21-prompt-injection-defenses)).
The `grounded-completion-v1` design therefore keeps immutable authority in a
system message and serializes all dynamic fields as data in a separately delimited
user message. Escaping `<`, `>`, `&`, and Unicode line separators before embedding
the JSON is an implementation-specific way to stop input from reproducing this
envelope's literal markers while preserving parseable data.

The public provider snapshots every allowed request value exactly once into frozen
plain data before it validates or prepares the prompt. The selected adapter receives
only the two prepared messages and a composed cancellation signal; it never receives
the caller's request object or raw context entries. The envelope parser validates an
exact runtime schema and returns a second minimized frozen snapshot, so delimited
`null`, arrays, extra keys, wrong field types, unsafe chunk indices, and over-budget
values fail with the fixed invalid-request error.

OWASP's RAG guidance recommends delimiters that explicitly label retrieved content
as untrusted data, but also says not to rely solely on prompt positioning and calls
for limits, screening, and model-specific testing
([RAG Security Cheat Sheet, section 3](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html#section-3-context-window-attacks)).
Accordingly, **the envelope and delimiter escaping are defense-in-depth, not prompt
injection immunity**. Adversarial delimiter tests prove structural integrity of the
serialization; they do not prove that a model will always obey the system message.

## Authorized context and fail-closed behavior

This provider accepts only context already authorized and selected by its caller.
It must not perform retrieval or infer access. OWASP requires access-control
metadata on chunks and enforcement at retrieval time
([RAG Security Cheat Sheet, section 4](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html#section-4-access-control-inheritance));
AISVS likewise requires retrieval operations to enforce scope constraints
([AISVS C8.1.3](https://github.com/OWASP/AISVS/blob/main/1.0/en/0x10-C08-Memory-Embeddings-and-Vector-Database.md#c81-access-controls-on-memory--rag-indices)).
Those controls remain outside this seam, and the `authorized context` terminology
records the caller's obligation rather than duplicating authorization here.

Empty context is rejected instead of allowing a model-only answer. This follows
OWASP's fail-closed example that a failed retrieval must not fall back to model
memory
([RAG Security Cheat Sheet, section 14](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html#section-14-fail-closed-design)).
Timeouts, cancellation, malformed requests, invalid results, unsupported providers,
and upstream failures likewise become bounded, stable error codes. The 30-second
default and 120-second configuration ceiling are local availability policies, not
values prescribed by OWASP.

The provider seam applies explicit Unicode code-point budgets before prompt
preparation: 4,000 for the question, 300 for each source title, 8,000 for each chunk,
50 context entries, and 32,000 aggregate title-plus-chunk code points. These are
local, provider-independent ceilings rather than model token claims. A future live
adapter may impose a smaller tokenizer-aware budget behind the same contract
([AISVS C2.1.4](https://github.com/OWASP/AISVS/blob/main/1.0/en/0x10-C02-Input-Validation.md#c21-prompt-injection-defenses)).

## Result validation and safe errors

AISVS requires model outputs to be validated against a defined schema and rejected
when they do not match
([AISVS C7.1.1](https://github.com/OWASP/AISVS/blob/main/1.0/en/0x10-C07-Model-Behavior.md#c71-output-format-enforcement)).
The validating wrapper consequently checks nonblank content, provider, model, and
prompt-version metadata and non-negative token counts before returning a result.
Output content is limited to 16,000 Unicode code points. Result objects are also
snapshotted exactly once before validation, preventing accessors or proxies from
substituting data between the check and the returned minimized result
([AISVS C7.1.2](https://github.com/OWASP/AISVS/blob/main/1.0/en/0x10-C07-Model-Behavior.md#c71-output-format-enforcement)).
The deterministic adapter is an offline implementation for stable development and
tests; its exact digest format is a product decision, not an OWASP control.

Errors expose only the documented completion code and safe fixed message. Raw
provider exceptions, thrown non-`Error` values, abort reasons, prompts, messages,
chunks, results, and credentials are neither retained nor copied into error fields.
This also prevents an untrusted upstream failure payload from becoming a new output
channel. Output policy classification is still a separate downstream control:
OWASP treats model output as untrusted until validated and warns against returning
raw model output in high-risk workflows
([RAG Security Cheat Sheet, section 9](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html#section-9-output-validation-and-enforcement)).

## Cancellation and timeout semantics

Node.js v24 defines `AbortSignal.timeout()` for deadline signals and
`AbortSignal.any()` for composing caller and timeout signals. The composed signal
adopts the reason of whichever input aborts it
([Node.js v24 `AbortSignal`](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html#class-abortsignal)).
Because an abort reason can be any value and `throwIfAborted()` throws that value,
the wrapper must classify cancellation or timeout without exposing the reason.
Node also recommends checking `aborted` before registering and using `{ once: true }`
listeners to avoid leaks. The adapter receives the composed signal, while the
wrapper separately races completion against abort so a non-cooperative adapter
cannot delay the caller indefinitely. HTTP-disconnect wiring remains the
orchestrator's responsibility.

The wrapper installs distinct one-shot listeners on the caller and timeout signals.
The first listener to run fixes the public classification, and settlement removes
those exact listener functions on resolution, rejection, cancellation, and timeout.

## NestJS registration and configuration

Nest supports symbols as non-class provider tokens, dynamic `useFactory` providers,
and exporting a custom provider by its token
([NestJS custom providers](https://docs.nestjs.com/fundamentals/custom-providers)).
That directly supports one exported completion contract with an environment-selected
implementation hidden behind it. Nest configuration guidance recommends rejecting
missing or invalid environment values during startup and supports a synchronous
custom validator that can transform values and stop bootstrap by throwing
([NestJS configuration](https://docs.nestjs.com/techniques/configuration#custom-validate-function)).
Startup validation plus an exhaustive runtime factory provides two independent
checks against an unknown provider or a timeout outside the inclusive 1–120,000 ms
integer range. Both fail synchronously with fixed non-sensitive errors.

## Content-minimized observability

AISVS calls for structured inference metadata including model identifier, token
usage, provider name, and operation type
([AISVS C12.1.3](https://github.com/OWASP/AISVS/blob/main/1.0/en/0x10-C12-Monitoring-and-Logging.md#c121-request--response-logging)).
The result contract therefore preserves provider, model, prompt version, and
optional token counts for later persistence or telemetry. The provider module itself
emits no prompt or result logs.

This is deliberate content minimization. The current OpenTelemetry GenAI span
conventions are marked Development; they make provider/model/token metadata part of
the inference schema while input messages, output messages, prompt variables, and
system instructions are opt-in and explicitly warn that they can contain sensitive
information
([OpenTelemetry GenAI span conventions](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md)).
Their principles inform this contract, but their unstable public attribute names are
not adopted. Any future content logging belongs in an audited orchestration or
telemetry layer with explicit retention, redaction, and access policies.

## Explicit exclusions

This issue does not implement retrieval authorization or context selection,
prompt-injection classifiers, citation selection, output-policy classifiers,
persistence, telemetry exporters, provider networking, streaming, or HTTP
disconnect propagation. The provider's defensive context budgets do not choose,
retrieve, rank, or authorize chunks. In particular, citations should later be
derived from retrieval metadata rather than invented by the model, as required by
[AISVS C7.4.2](https://github.com/OWASP/AISVS/blob/main/1.0/en/0x10-C07-Model-Behavior.md#c74-source-attribution--citation-integrity).

## Primary sources used

- [OWASP AISVS 1.0: C2 Input Validation](https://github.com/OWASP/AISVS/blob/main/1.0/en/0x10-C02-Input-Validation.md)
- [OWASP AISVS 1.0: C7 Model Behavior, Output Control & Safety Assurance](https://github.com/OWASP/AISVS/blob/main/1.0/en/0x10-C07-Model-Behavior.md)
- [OWASP AISVS 1.0: C8 Memory, Embeddings & Vector Database Security](https://github.com/OWASP/AISVS/blob/main/1.0/en/0x10-C08-Memory-Embeddings-and-Vector-Database.md)
- [OWASP AISVS 1.0: C12 Monitoring, Logging & Anomaly Detection](https://github.com/OWASP/AISVS/blob/main/1.0/en/0x10-C12-Monitoring-and-Logging.md)
- [OWASP Retrieval-Augmented Generation Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
- [NestJS custom providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [NestJS configuration](https://docs.nestjs.com/techniques/configuration)
- [Node.js v24 global `AbortSignal` documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html#class-abortsignal)
- [OpenTelemetry GenAI span semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md)
