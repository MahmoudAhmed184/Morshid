# F13: Conversation pinning and archive

**Difficulty:** Moderate  
**Dependencies:** None

## Outcome

Let Students organize important Conversations without confusing archive with
deletion.

## Contract

- Persist `pinnedAt` and `archivedAt` on the Student-owned Conversation.
- Active pinned Conversations appear before chronological groups and sort by
  latest activity. Unpinned active Conversations retain current grouping.
- Archiving clears the pin, removes the Conversation from the active list, and
  blocks new turns. It preserves messages, citations, Review Cases, and inbox
  links.
- Add an Archived view scoped to the active Course. Students can open a
  read-only Conversation, restore it, or use the existing delete flow.
- Pin, unpin, archive, and restore are idempotent and enforce active Course
  membership and Conversation ownership.
- Do not overload the existing `deletedAt` meaning or add compatibility aliases.

## Acceptance criteria

- [ ] List pagination has stable ordering with pinned and unpinned records.
- [ ] Archived records never appear in active search or lists and appear only
      in their owner's Course-scoped Archived view.
- [ ] Restore returns a Conversation to normal chronological placement.
- [ ] An in-flight turn prevents archive with a clear conflict response.
- [ ] Deleted and archived states remain distinct across API, database, and UI.
- [ ] Unit, repository E2E, and Student acceptance tests cover authorization,
      pagination, restore, Review Case links, and concurrent mutations.

## Out of scope

Folders, manual drag ordering, bulk archive, Instructor access, and archiving an
entire Course.

