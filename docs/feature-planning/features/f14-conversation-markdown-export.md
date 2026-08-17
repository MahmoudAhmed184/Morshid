# F14: Conversation Markdown export

**Difficulty:** Moderate  
**Dependencies:** None

## Outcome

Let a Student download one complete authorized Conversation as a portable,
human-readable Markdown file.

## Contract

- Generate the complete export on the server so pagination cannot truncate it.
- Include product name, Course code and title, Conversation title, export time,
  visible Student and Assistant messages, timestamps, guidance labels,
  citations, and published Instructor-reviewed guidance.
- Exclude system messages, prompts, model/provider metadata, token counts,
  internal analysis, Review Evidence, private Instructor drafts, and secrets.
- Escape raw HTML and choose safe Markdown fences so user content cannot break
  the document structure. Produce a filesystem-safe UTF-8 filename.
- Enforce current Student ownership and active or archived Course access. Log an
  export Audit Event before returning content; fail the export if auditing fails.
- Deleted Conversations remain unavailable under existing deletion policy.

## Acceptance criteria

- [ ] Exports contain every visible message in sequence order with stable
      citation references.
- [ ] Large histories stream or remain within an explicit bounded response
      policy without loading unbounded data into memory.
- [ ] Markdown containing fences, HTML, RTL text, emoji, and long lines remains
      valid and does not expose hidden fields.
- [ ] Unauthorized Course, Student, and deleted-session requests do not leak
      existence.
- [ ] API E2E and acceptance tests verify content, filename, audit failure, and
      privacy exclusions.

## Out of scope

PDF export, bulk account export, importing Markdown, sharing links, and
Instructor export of Student Conversations.

