# Morshid (مرشد)

A Socratic AI teaching assistant for ITI computing courses. Students get hints, questions, and cited explanations. They don't get final answers.

Instructors upload course PDFs. Every response is grounded in those materials. When Morshid isn't sure, or when a response might be leaking a solution, it flags the exchange for the instructor to review.

---

## How it works

**Students** chat inside their enrolled course. The request type determines what happens:

- **Conceptual question** → explanation with citations from the course PDFs
- **Assignment or problem** → hint ladder (4 levels), no solution given
- **Buggy code** → bug identification and pointers, not a rewrite
- **Outside the course material** → labeled as general knowledge; flagged if the question is grade-sensitive

**Instructors** get a review queue. They can approve, edit, or replace any flagged response. The student sees the outcome in their chat.

**Admins** handle user accounts, course assignments, and materials.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | TanStack Start · React · Shadcn/ui · TailwindCSS v4 · TanStack Query · Zustand |
| Backend | NestJS (TypeScript) — auth, RBAC, RAG pipeline, AI orchestration, SSE streaming |
| AI | LLM via provider abstraction · RAG with pgvector |
| Database | PostgreSQL + pgvector · Redis |
| Infrastructure | Docker Compose · Caddy · GitHub Actions CI |

If ITI requires a Python component, a Django service handles AI/RAG internally. NestJS stays the only public API either way.

---

## What makes it different from a chatbot

- Retrieval is scoped per course. A student can't pull material from a course they're not in.
- If the PDFs don't support a claim, Morshid says so instead of making something up.
- Problem-like requests get hints, not solutions. The constraint is enforced in the prompt policy and tested against a locked evaluation set.
- Instructors are the last line of defense on uncertain or risky responses.

---

Graduation project, July–August 2026. Team ThinkFirst, 5 developers. More detail in [`docs/`](./docs/).
