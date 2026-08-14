# 02. Repository Structure & Workspace Organization

Morshid is organized as an npm workspace monorepo containing a full-stack TypeScript codebase with strict type-checking, architectural boundary enforcement, and isolated package ownership.

---

## 1. Monorepo Root Layout

```
morshid/
├── .github/                    # CI/CD GitHub Actions workflows
│   └── workflows/ci.yml        # Continuous integration pipeline (validate & acceptance jobs)
├── client/                     # TanStack Start / React 19 Frontend Workspace
├── server/                     # NestJS Backend API Workspace
├── scripts/                    # Repository maintenance, seed, verification & reset scripts
├── tests/                      # Acceptance testing suites
│   └── acceptance/             # Playwright browser end-to-end user journeys
├── storage/                    # Local storage root for uploaded PDF files
│   └── pdfs/                   # Uploaded course PDFs named by UUID (<uuid>.pdf)
├── docs/                       # Architectural documentation & ADRs
│   ├── adr/                    # Accepted Architectural Decision Records (0001–0008)
│   └── developer-guide/        # Developer onboarding documentation (current guide)
├── dependency-cruiser.config.mjs# Repository architecture & dependency graph rules
├── docker-compose.yml          # Container configuration for PostgreSQL, Redis, and server
├── eslint.config.mts           # Monorepo root ESLint flat configuration
├── prettier.config.mts         # Prettier code formatting configuration
├── playwright.config.ts        # Playwright test configuration
├── tsconfig.json               # Root TypeScript configuration
├── package.json                # Root package manifest & canonical script runner
└── AGENTS.md                   # Repository engineering guidelines and coding standards
```

---

## 2. Workspaces Configuration

The monorepo defines two primary npm workspaces in the root [`package.json`](file:///home/mahmoud-ahmed/Projects/Morshid/package.json):

```json
{
  "name": "morshid",
  "private": true,
  "packageManager": "npm@11.18.0",
  "engines": {
    "node": ">=24.7 <25",
    "npm": ">=11"
  },
  "workspaces": [
    "client",
    "server"
  ]
}
```

### Dependency Overrides
To ensure deterministic dependency resolution and security patching, root overrides are pinned:
- `@nestjs/platform-express`: Pins `multer` to `2.2.0` (for memory storage and PDF stream handling).
- `@prisma/dev`: Pins `@hono/node-server` to `1.19.14`.

---

## 3. Server Directory Structure (`server/`)

The server codebase follows a **capability-first** architecture ([ADR 0001](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0001-capability-first-ownership.md)):

```
server/
├── prisma/                     # Multi-file Prisma schemas & migrations
│   ├── schema.prisma           # Datasource & generator config
│   ├── identity.prisma         # Users, roles, refresh tokens
│   ├── courses-and-materials.prisma # Courses, memberships, materials, chunks
│   ├── conversations.prisma    # Chat sessions, messages, citations
│   ├── tutoring.prisma         # Topics, topic states, attempts, analyses, decisions, guards
│   ├── reviews.prisma          # Review cases, actions, review inbox items
│   ├── audit.prisma            # Audit log records
│   ├── migrations/             # Clean-slate migration SQL (20260811150000_initial)
│   ├── seed.ts                 # Database seed script
│   └── assert-catalog.mts      # Database catalog semantic hash verification
├── src/
│   ├── main.ts                 # Application entry point (NestFactory bootstrap)
│   ├── app.setup.ts            # Global filters, interceptors, pipes, and OpenAPI setup
│   ├── app.module.ts           # Root AppModule wiring
│   ├── application/            # Cross-capability presentation adapters & filters
│   ├── common/                 # Product-independent framework primitives (HTTP, text, validation)
│   ├── platform/               # Infrastructure adapters (database, cache, AI, document storage)
│   ├── modules/                # Capability-first business logic modules
│   │   ├── identity/           # Authentication, authorization, password hashing, user admin
│   │   ├── courses/            # Course creation, access policy, membership management
│   │   ├── materials/          # PDF upload, text extraction, chunking, course evidence
│   │   ├── tutoring/           # Socratic tutoring engine, 7-phase runtime, prompt building
│   │   ├── conversations/      # Chat session persistence, ordered turns, context window
│   │   ├── reviews/            # HITL review queue, moderation, student inbox
│   │   ├── audit/              # Immutable audit logging service and controller
│   │   └── health/             # Terminus liveness and readiness probes
│   ├── generated/              # Generated code directory (Prisma Client)
│   └── seeds/                  # Seed datasets and deterministic demo course fixtures
├── test/                       # Server test suites
│   ├── support/                # Disposable database helpers and controllable AI test doubles
│   └── *.e2e-spec.ts           # Integration and E2E test suites
├── tsconfig.json               # Server TypeScript configuration
└── package.json                # Server package manifest and scripts
```

---

## 4. Client Directory Structure (`client/`)

The client is a Single Page Application built on **Vite**, **TanStack Start / Router**, and **TanStack Query** ([ADR 0005](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0005-frontend-features-and-workspaces.md)):

```
client/
├── src/
│   ├── app/                    # Application composition, router provider, root providers
│   │   ├── app-providers.tsx   # QueryClientProvider, devtools, toast container
│   │   └── router.tsx          # getRouter() helper creating TanStack Router
│   ├── routes/                 # Thin route entry points (TanStack Router file-based tree)
│   │   ├── __root.tsx          # App root document shell and layout
│   │   ├── index.tsx           # Landing page
│   │   ├── login.tsx           # Authentication view (redirects authenticated users)
│   │   ├── health.tsx          # System diagnostic and health probe view
│   │   ├── _student.tsx        # Student workspace layout & role guard
│   │   ├── instructor/         # Instructor routes (materials, review-queue)
│   │   └── admin/              # Admin routes (users, courses, audit, settings)
│   ├── workspaces/             # Role-specific composition shells
│   │   ├── _shared/            # Shared authenticated headers and navigation
│   │   ├── student/            # Student chat workspace, citations drawer, review modal
│   │   ├── instructor/         # Instructor course cards, PDF uploader, review workspace
│   │   └── admin/              # Admin user table, audit log explorer, course manager
│   ├── features/               # Domain features & strict public interfaces
│   │   ├── auth/               # Session store (Zustand), authenticated API fetch, login form
│   │   ├── chat/               # Socratic conversation view, citations, message lists
│   │   ├── courses/            # Course listing, selectors, readiness badges
│   │   ├── materials/          # Material upload forms, processing progress
│   │   ├── reviews/            # Review queue, resolution panels, student inbox
│   │   ├── user-management/    # Admin user creation, bulk import, role editor
│   │   ├── audit/              # System audit log viewer table
│   │   ├── system-status/      # AI providers and database health cards
│   │   └── account-settings/   # User password change, preferences
│   ├── components/             # Shared, feature-independent UI primitives (buttons, dialogs, inputs)
│   ├── lib/                    # Infrastructure utilities (HTTP fetch wrapper, query client, cn())
│   ├── routeTree.gen.ts        # Generated TanStack Router tree (DO NOT HAND EDIT)
│   └── test/                   # Client Vitest setup and testing utilities
├── vite.config.ts              # Vite bundler and test configuration
└── package.json                # Client package manifest and dependencies
```

---

## 5. Root Operational Scripts (`scripts/`)

The `scripts/` directory contains critical verification, migration, and maintenance utilities:

| Script File | Purpose & Verification Logic | Associated Command |
|---|---|---|
| [`catalog-semantics.mts`](file:///home/mahmoud-ahmed/Projects/Morshid/scripts/catalog-semantics.mts) | Computes SHA-256 semantic fingerprint of the PostgreSQL database schema to detect weakened constraints. | `npm run db:assert-catalog` |
| [`verify-generated-ownership.mts`](file:///home/mahmoud-ahmed/Projects/Morshid/scripts/verify-generated-ownership.mts) | Re-generates Prisma client and TanStack routes, verifying that checked-in generated files match their SHA-256 hashes without manual modification. | `npm run test:generated-ownership` |
| [`fresh-seed-demo.mts`](file:///home/mahmoud-ahmed/Projects/Morshid/scripts/fresh-seed-demo.mts) | 5-stage automated reset, seed, lint, typecheck, architecture check, and E2E test gate. | `npm run demo:fresh-seed` |
| [`reset-local-db.mts`](file:///home/mahmoud-ahmed/Projects/Morshid/scripts/reset-local-db.mts) | Safely resets and drops all local PostgreSQL tables with safety confirmation guards (`MORSHID_RESET_CONFIRM=reset-local`). | `npm run db:reset` |
| [`clear-local-review-data.mts`](file:///home/mahmoud-ahmed/Projects/Morshid/scripts/clear-local-review-data.mts) | Clears review cases and inbox items for review workflow reset testing (`MORSHID_REVIEW_CLEANUP_CONFIRM=clear-local-reviews`). | `npm run reviews:clear-local` |

---

## 6. Generated Files Policy

> [!IMPORTANT]
> **Never hand-edit generated files:**
> - `server/src/generated/prisma/`
> - `client/src/routeTree.gen.ts`

These files are owned by their respective code generators (`prisma generate` and `@tanstack/router-cli`). The repository enforces this rule via `npm run test:generated-ownership`, which verifies that re-generating them creates byte-for-byte identical output to the committed files.
