# Retrieval Threshold Calibration

The Python MVP retrieval diagnostic found that the previous
`RETRIEVAL_MIN_SIMILARITY=0.7` cutoff rejected clearly relevant Gemini matches
for the controlled Python corpus. The calibrated MVP floor is now `0.62`.

Future hardening recommendation, not implemented in the MVP calibration fix:

```text
larger vector candidate set -> relevance/reranking -> final evidence acceptance
```
