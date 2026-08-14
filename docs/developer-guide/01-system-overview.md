# 01. System Overview & Mental Model

**Morshid** (مرشد, Arabic for "Guide" or "Advisor") is an enterprise-grade, pedagogical AI tutoring platform. It is engineered specifically to deliver grounded, Socratic educational guidance to students while strictly adhering to pedagogical guardrails and instructor oversight.

---

## 1. Core Mental Model & Pedagogical Principles

Unlike standard conversational chatbots that generate direct answers or code solutions, Morshid operates as an active **Socratic Tutor**.

```mermaid
flowchart TD
    subgraph Traditional["Traditional Chatbot / LLM Wrapper"]
        Q1[Student: 'Write me a function for binary search'] --> A1[LLM: 'Here is the complete code...']
        A1 --> F1[Short-circuits learning]
    end

    subgraph MorshidModel["Morshid Socratic System"]
        Q2[Student: 'Write me a function for binary search'] --> V[Validate Course & Evidence]
        V --> EA[Educational Analysis: Misconception & Effort]
        EA --> TP[Teaching Decision: Guidance Level & Strategy]
        TP --> TG[Tutor Generation: Socratic Probing Question]
        TG --> SG[3-Stage Guardrails & Over-Reveal Check]
        SG --> A2[Tutor: 'What is the middle element condition in an array?']
        A2 --> F2[Encourages active discovery]
    end
```

### Core Pedagogical Invariants:
1. **Never Give the Final Answer / Code Solution**: The system enforces a strict `NO_FINAL_ANSWER` reveal policy. It will never generate copy-pasteable assignment solutions or complete function implementations.
2. **Strict Grounding on Course Materials**: All factual teaching points must be grounded in verified, instructor-uploaded PDF materials for the student's enrolled course.
3. **Non-Executable Debugging Guidance**: When a student submits broken code, the tutor analyzes logical or syntax misunderstandings and asks guiding questions. Student code is **never executed in a sandbox/VM**, preventing security hazards and output cheating.
4. **Human-in-the-Loop (HITL) Fallback**: Any model low-confidence detection, potential safety violation, or student-escalated query is immediately queued for instructor review.

---

## 2. User Personas & System Roles

Morshid defines three distinct, mutually isolated roles:

```mermaid
graph LR
    subgraph Roles["System Personas"]
        S[Student]
        I[Instructor]
        A[Admin]
    end

    subgraph Capabilities["Workspace Capabilities"]
        S -->|Accesses| C1[Socratic Chat & Citations]
        S -->|Accesses| C2[Review Inbox & Clarifications]
        
        I -->|Accesses| M1[Course Materials & PDF Ingestion]
        I -->|Accesses| M2[Course Readiness Diagnostics]
        I -->|Accesses| M3[Human-in-the-Loop Review Queue]

        A -->|Accesses| G1[User Administration & Bulk Import]
        A -->|Accesses| G2[System Health & AI Providers Status]
        A -->|Accesses| G3[Audit Log Viewer]
    end
```

### 1. Student (`STUDENT`)
- Interacts with the AI tutor through course-scoped conversational chat sessions.
- Receives iterative hints, conceptual explanations, and source citations linked to exact PDF chunks.
- Can flag any turn by clicking **"Request Instructor Review"**.
- Receives direct instructor resolutions in their student inbox.

### 2. Instructor (`INSTRUCTOR`)
- Manages assigned courses and uploads course syllabi, lecture notes, and textbooks (PDF format).
- Monitors material processing status (`PROCESSING` -> `READY` / `WARNING` / `FAILED`).
- Reviews course readiness reports before opening tutoring to students.
- Moderates the **Review Queue**: reviews student-flagged or guardrail-flagged turns, providing overrides, explanations, or approvals.

### 3. Administrator (`ADMIN`)
- Governs the overall tenant: creates/updates/disables users, assigns instructor/student course memberships, and handles bulk CSV/JSON user imports.
- Monitors system health probes (`/health/live`, `/health/ready`), PostgreSQL/Redis connectivity, and AI provider status.
- Inspects comprehensive, tamper-evident audit logs (`audit_logs`).

---

## 3. High-Level Architectural Topology

Morshid is built as an npm workspace monorepo consisting of a modern client SPA and a structured NestJS backend supported by PostgreSQL (with `pgvector`), Redis, and external AI providers.

```mermaid
flowchart TB
    subgraph Browser["Client Application (Browser)"]
        UI["TanStack Start / React 19 SPA (Port 3000)"]
        Router["TanStack Router (Thin Routes)"]
        Workspaces["Workspaces (admin / instructor / student)"]
        Features["Features (chat, courses, materials, reviews, auth)"]
        Query["TanStack Query (Cache & State)"]
        
        UI --> Router --> Workspaces --> Features --> Query
    end

    subgraph Network["Network & API Boundary"]
        HTTP["REST API: /api/v1/* (Port 4000)"]
        AuthCook["HttpOnly Cookies + JWT Bearer"]
    end

    subgraph Backend["NestJS Application Server"]
        Guards["IdentityGuard + RolesGuard"]
        Pipes["ZodValidationPipes"]
        Modules["Capability Modules (Identity, Courses, Materials, Tutoring, Reviews, Audit)"]
        Runtime["Socratic Tutoring Runtime (7-Phase Engine)"]
        Platform["Platform Adapters (Prisma, Redis, Storage, AI Gateway)"]
        
        Guards --> Pipes --> Modules --> Runtime --> Platform
    end

    subgraph Persistence["Storage & Infrastructure"]
        PG[("PostgreSQL 18 + pgvector (0.8.4)")]
        Redis[("Redis 8.4 (Token Buckets & Gemini Pool)")]
        PDFStore[("Local PDF Document Storage (UUID.pdf)")]
    end

    subgraph ExternalAI["External AI Services"]
        EmbedModel["Embedding Model (Deterministic / Gemini v1beta)"]
        LLMAnalysis["Analysis Model (Qwen2.5-14B / OpenAI-Compatible)"]
        LLMTutor["Tutor Model (Qwen2.5-7B / OpenAI-Compatible)"]
        LLMGuard["Semantic Guard Model (Qwen2.5-7B-Guard)"]
    end

    Query <-->|JSON over HTTP| HTTP
    HTTP --> Guards
    Platform <--> PG
    Platform <--> Redis
    Platform <--> PDFStore
    Platform <--> ExternalAI
```

---

## 4. Key End-to-End System Invariants

1. **Strict Dependency Graph**: Production architecture enforces an acyclic dependency graph via `dependency-cruiser`. Framework platform adapters and common utilities never import business capability modules; capability modules never cross boundaries except through explicit public interfaces.
2. **Transaction-Bounded Atomicity (ADR 0007)**: Cross-capability database operations (such as finalizing a tutoring turn, creating message retrievals, updating topic state, and inserting audit logs) execute atomically within an opaque `DatabaseTransaction` contract without leaking Prisma-specific client types across seams.
3. **Corpus Isolation & Course Readiness**: A student query is never embedded or matched against a course until all candidate materials in that course are 100% indexed in the active vector space. Partial indexing blocks retrieval for that course to prevent hallucinations and ungrounded output.
4. **Project-Aware Gemini Chat Pool (ADR 0008)**: High-concurrency AI chat calls are distributed round-robin across an array of distinct Google Cloud quota projects via Redis, with automatic jittered exponential backoff upon receiving HTTP 429 status codes.
