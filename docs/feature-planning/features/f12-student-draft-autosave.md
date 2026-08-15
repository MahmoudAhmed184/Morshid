# F12: Student draft autosave

**Difficulty:** Easy  
**Dependencies:** None

## Outcome

Protect unsent Student work across navigation, refresh, and accidental tab
closure without storing drafts on the server.

## Contract

- Save composer text locally by authenticated user, Course, and Conversation;
  use a distinct key for each Course's new-Conversation draft.
- Debounce writes, restore only into an empty composer, and announce restoration
  without stealing focus.
- Clear a draft only after its message is accepted successfully, when the user
  explicitly discards it, or when its Conversation is archived or deleted.
- Expire drafts after 30 days and remove expired records opportunistically.
- Never render another user's drafts on a shared browser. Treat unavailable or
  full browser storage as a recoverable condition and keep the current text.
- Explain that drafts are stored on this device; do not put them in logs,
  analytics, query caches, or server requests before submission.

## Acceptance criteria

- [ ] Drafts survive refresh and Course or Conversation navigation.
- [ ] Drafts for different users, Courses, sessions, and new chats never collide.
- [ ] A failed or rate-limited submission retains the text; a successful one
      clears exactly the submitted draft.
- [ ] Expired, corrupt, and unsupported stored values are ignored safely.
- [ ] Restore, discard, and storage-failure status are accessible.
- [ ] Tests use fake timers and storage adapters rather than real delays.

## Out of scope

Cross-device draft sync, draft history, collaborative editing, attachments, and
server-side recovery.

