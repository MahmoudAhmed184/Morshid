# F27: Audit CSV export

**Difficulty:** Moderate  
**Dependencies:** None

## Outcome

Let Admins download a bounded, spreadsheet-safe export of filtered Audit Events.

## Contract

- Require an explicit start and end time no more than 90 days apart plus at
  least one scope filter such as action, actor, Course, or target type.
- Export at most 50,000 rows in stable chronological and ID order. If more rows
  match, reject with an instruction to narrow filters rather than truncate.
- Include event ID, timestamp, action, actor identity, target type and ID,
  Course identity, source IP, user agent, and action-specific allowlisted safe
  metadata. Exclude raw metadata by default.
- Treat the file as a human spreadsheet export. Centralize serialization, quote
  every field, double internal quotes, and neutralize cells beginning with
  formula-control prefixes, delimiters, quotes, newlines, or full-width formula
  variants. Use a separate future format for lossless machine interchange.
- Stream cursor pages with bounded memory and a safe UTF-8 filename. Record an
  Audit Event containing filters and row count before returning the file.
- Never export credentials, token hashes, cookies, private Course content,
  Student messages, Review Evidence, or secrets embedded in error metadata.

## Acceptance criteria

- [ ] Exported rows exactly match authorized filters and deterministic ordering.
- [ ] Dangerous spreadsheet prefixes, quotes, commas, CR/LF, tabs, Unicode, and
      full-width variants cannot become formulas or new cells.
- [ ] Over-limit, invalid-range, audit-failure, and cross-role requests return
      safe actionable errors and no partial file.
- [ ] Large-export tests verify bounded memory behavior.
- [ ] E2E tests use adversarial metadata and prove all excluded content remains
      absent.

## Out of scope

JSON or SIEM export, scheduled reports, email delivery, unbounded downloads,
and lossless re-import.

