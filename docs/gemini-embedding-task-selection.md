# Gemini embedding query-task selection

Status: **candidate selected, comparison outstanding.**
Date: 2026-07-26

## What this decides

`gemini-embedding-2` does not support `taskType` — Google replaced it with
prompt prefixes — so the retrieval task is a string embedded in the query text
rather than a request field. This note records which task string the query
protocol uses.

The current value is `search result`, encoded as query protocol
`gemini/gemini-embedding-2/search-result-v1` and built by
`buildGeminiQueryInput` as:

```text
task: search result | query: <query>
```

## Why the choice is cheap to revisit

Google documents the **same document format** for both retrieval tasks — only
the query prefix differs. The document profile and the query protocol are
therefore versioned separately in this codebase:

- `EmbeddingProvider.model` — `gemini/gemini-embedding-2/1536/document-v1` — is
  the persisted document profile that retrieval filters on. Changing it requires
  a full re-embed.
- `EmbeddingProvider.queryProtocol` — this note's subject — is diagnostic-only
  and changing it costs **no re-embed**.

So the losing task costs a query-protocol bump, nothing more.

The trade-off, stated plainly: because a query-protocol change does not alter
any stored value, the profile filter cannot detect it. The logged
`queryProtocol` is what makes such a change observable at all;
`message_retrievals` has no column for it, so you cannot reconstruct which
protocol produced an already-stored answer. That is a deliberate scope
limitation, not provenance.

## The comparison, when it runs

**Must finish before the query protocol is frozen.** Compare
`task: search result` against `task: question answering` over representative
course fixtures covering:

- direct factual questions
- paraphrased questions
- conceptual explanations
- code questions
- queries whose relevant passage does not repeat the query wording

Use **two disjoint fixture sets**: calibration fixtures to select the task and
the margin, and held-out validation fixtures to confirm the selected protocol.
Selecting and validating on the same fixtures proves nothing. The held-out set
is the one `server/test/fixtures/gemini-embedding-live-smoke.fixture.ts` draws
from.

Metrics to record:

- Recall@K
- mean reciprocal rank
- top-one accuracy
- relevant-vs-irrelevant cosine margin

`MIN_SEMANTIC_MARGIN` for the live smoke assertion is calibrated **per provider,
after measuring both** — it is not a shared constant.

Record the full comparison here, redacted: no course text, no vector values, no
credentials.

## Results

| Task | Recall@5 | MRR | Top-1 | Margin |
| --- | --- | --- | --- | --- |
| `search result` | _pending_ | _pending_ | _pending_ | _pending_ |
| `question answering` | _pending_ | _pending_ | _pending_ | _pending_ |

Until this table is filled in, `search result` is the **initial candidate**, not
a measured winner. Do not describe it as validated.
