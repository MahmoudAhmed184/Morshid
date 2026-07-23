# Gemini 3.5 Flash-Lite free-tier quotas

Research date: 2026-07-23

Scope: Gemini Developer API model status, free-tier pricing, interactive
rate limits, and API-key guidance. Only first-party Google sources were used.
No credential was used or tested.

## Executive conclusion

`gemini-3.5-flash-lite` is a stable, generally available model and its
standard Gemini Developer API input and output are eligible for the free
tier. Google does **not** publish one authoritative set of interactive
RPM, input TPM, and RPD numbers that can safely be copied into this
deployment. Its current rate-limit documentation directs operators to the
signed-in Google AI Studio Rate Limit page for the active values and says
that limits depend on project usage tier, model, and account status.

Therefore:

- Keep `GEMINI_MODEL=gemini-3.5-flash-lite`.
- Do not infer or copy RPM, input TPM, or RPD from an old table, another
  model, another project, or a third-party post.
- A project operator must open the
  [AI Studio Rate Limit dashboard](https://aistudio.google.com/rate-limit?timeRange=last-28-days),
  select the project and `gemini-3.5-flash-lite`, and copy its current RPM,
  input TPM, and RPD values.
- Configure the corresponding Morshid caps at no more than 90% of those
  values (use `floor(provider limit × 0.90)`).
- `GEMINI_REQUESTS_PER_HOUR` and `GEMINI_REQUESTS_PER_MONTH` are
  Morshid-owned budgets, not published Gemini quota dimensions. Operators
  must choose them within the application's required ordering rather than
  presenting them as Google limits.

## Model status

Google identifies the exact model code as `gemini-3.5-flash-lite`, lists
its version as **Stable**, and records its latest update as July 2026. The
model page lists a 1,048,576-token input limit and a 65,536-token output
limit. These context limits are not rate limits and must not be used as
TPM values.

Google's latest-model guide separately says Gemini 3.5 Flash-Lite is
generally available and ready for production use. It documents `minimal`
as the default thinking level.

Sources:

- [Gemini 3.5 Flash-Lite model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
- [Using the latest Gemini models](https://ai.google.dev/gemini-api/docs/latest-model)

## Free-tier eligibility and pricing

The official pricing table describes Gemini 3.5 Flash-Lite as a GA model
and lists standard free-tier input and output as free of charge. The paid
standard prices are USD $0.30 per million input tokens and USD $2.50 per
million output tokens, including thinking tokens.

The free tier does not include context caching, Google Search grounding, or
Google Maps grounding for this model. The same table says free-tier inputs
and outputs are used to improve Google's products, while paid-tier inputs
and outputs are not. Free-tier eligibility therefore does not change the
project's synthetic, permission-safe data restriction.

Source:

- [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite)

## Interactive rate limits

Google describes the usual interactive dimensions as:

- requests per minute (RPM);
- input tokens per minute (TPM); and
- requests per day (RPD).

The official documentation states that limits are applied per project,
not per API key, and vary by model. RPD resets at midnight Pacific time.
It also states that limits depend on factors such as usage tier, update as
project tier and account status change, are not guaranteed, and may differ
from actual capacity.

As of the research date, the public rate-limit page does not provide
interactive RPM, input TPM, or RPD numbers for
`gemini-3.5-flash-lite`. It instead links to the signed-in AI Studio Rate
Limit page for active limits. The public page's
`10,000,000` value for this model is a **Tier 1 Batch API enqueued-token
limit**; it is not interactive input TPM and must not be copied into
`GEMINI_INPUT_TOKENS_PER_MINUTE`.

### Values safe to put in configuration

| Configuration | Public value available? | Required source |
| --- | --- | --- |
| `GEMINI_REQUESTS_PER_MINUTE` | No | Current project/model RPM in signed-in AI Studio, capped at 90% |
| `GEMINI_INPUT_TOKENS_PER_MINUTE` | No | Current project/model input TPM in signed-in AI Studio, capped at 90% |
| `GEMINI_REQUESTS_PER_DAY` | No | Current project/model RPD in signed-in AI Studio, capped at 90% |
| `GEMINI_REQUESTS_PER_HOUR` | Not a documented Google quota dimension | Operator-selected Morshid budget |
| `GEMINI_REQUESTS_PER_MONTH` | Not a documented Google quota dimension | Operator-selected Morshid budget |

No numeric replacement for these five variables is defensible from public
Google documentation alone.

Source:

- [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

## API-key guidance

Google treats a Gemini API key like a password and instructs operators not
to commit it to source control or expose it client-side. If a key may have
leaked, Google instructs the operator to generate a replacement, update
the application, disable or delete the compromised key after the
replacement is active, and audit billing and API usage.

Google is transitioning from Standard keys to authorization (auth) keys:

- New keys created in Google AI Studio are auth keys by default.
- Auth keys are bound to a Google Cloud service account and restricted to
  the Generative Language API by default.
- The Gemini API is scheduled to reject Standard keys in September 2026.
- Operators can verify key type in AI Studio's **Key Type** column; a key's
  type must not be guessed from its text or tested merely to identify it.

Because a credential was posted in the conversation, it should be treated
as compromised. This research did not reproduce, inspect, call, or test
that credential. The safe next action is to revoke it, audit its usage, and
create a new auth key in AI Studio before any live smoke test.

Source:

- [Using Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key)

## Operator checklist

1. Revoke the exposed key and audit its project usage without using it.
2. Create a replacement key in Google AI Studio and confirm **Key Type**
   is authorization/auth.
3. Open the signed-in AI Studio Rate Limit dashboard for the same project.
4. Select `gemini-3.5-flash-lite` and record current RPM, input TPM, and
   RPD.
5. Set each provider-derived cap to
   `floor(current AI Studio value × 0.90)`.
6. Choose explicit hour and month budgets that satisfy the application's
   cap relationships and internal risk tolerance.
7. Put only the replacement key and approved caps in the ignored local
   environment file.
8. Run the synthetic live smoke test once, then proceed with the
   development demo using synthetic, permission-safe data only.
