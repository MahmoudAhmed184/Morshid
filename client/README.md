# Morshid client

The frontend client for Morshid is a strict TypeScript React 19 single-page application built on TanStack Start and TanStack Router, styled with Tailwind CSS v4 and shadcn/ui primitives, and managed with TanStack Query v5 and Zustand.

It implements role-specific workspace layouts, optimistic Socratic chat updates, interactive review triage workflows, and administrative management portals.

---

## Architecture and structure

The client codebase is organized into layers following [ADR 0005](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0005-frontend-features-and-workspaces.md) and [AGENTS.md](file:///home/mahmoud-ahmed/Projects/Morshid/AGENTS.md):

```
client/src/
├── app/                  # Root application composition, router instance, global styles, providers
├── components/           # Reusable, feature-independent UI primitives (shadcn/ui), brand icons, custom kit
├── features/             # Domain capabilities (API callers, TanStack Query hooks, Zod schemas)
│   ├── account-settings/ # User preferences, theme switching, 6 color palettes
│   ├── audit/            # Admin audit trail queries
│   ├── auth/             # Session store (Zustand), sign-in forms, token refresh, role guards
│   ├── chat/             # Socratic chat messages, session management, citations drawer, retry hooks
│   ├── courses/          # Course access, memberships, and course administration
│   ├── landing/          # Public marketing page (Hero, Socratic method walkthrough, CTA)
│   ├── materials/        # PDF upload, chunking/ingestion status polling, catalog views
│   ├── reviews/          # Student review requests/inbox & Instructor review queue/triage
│   ├── system-status/    # Health status page (/health)
│   └── user-management/  # Admin user CRUD, CSV bulk student/instructor import
├── lib/                  # HTTP clients, environment variables, custom utility hooks
├── routes/               # Thin TanStack Router file-based route definitions
└── workspaces/           # Role-specific layouts, shells, and composed workspace views
    ├── _shared/          # Authenticated responsive sidebar with user profile, theme & signout
    ├── student/          # Tutor workspace, Socratic chat, sources drawer, review inbox
    ├── instructor/       # Instructor dashboard, material management, review queue & editor
    └── admin/            # Admin dashboard, user management, course setup, assignments, audit
```

### Route generation and boundaries
- TanStack Router manages file-based routing. **Never hand-edit `src/routeTree.gen.ts`**; the router CLI generates it automatically.
- All internal imports use the `@/*` alias mapping to `client/src/*`.
- Run `npm run test:architecture:client` to verify dependencies between features and workspaces.

---

## Role workspaces and supported screens

Morshid provides three authenticated workspaces:

### 1. Student workspace (`/_student`, requires `STUDENT` role)
- `/chat`: Main Socratic tutoring hub.
  - Welcome and prompt starters when no session is selected.
  - Active conversation stream rendering Markdown, LaTeX math formulas, code blocks, hint levels, and guidance badges.
  - Collapsible sources drawer displaying course PDF citations and exact quote snippets.
  - In-place retry for failed or fallback turns.
  - Review request modal allowing students to flag messages to instructors (max 3/day).
  - Review inbox notification badge in the header cluster with unread counter and links to target messages.
  - Global `⌘K` search palette across conversation titles and content.

### 2. Instructor workspace (`/instructor`, requires `INSTRUCTOR` role)
- `/instructor/`: Dashboard displaying assigned course metrics, material readiness, and pending review counts.
- `/instructor/materials/`: PDF upload modal (drag-and-drop, size validation), material deletion, and automatic polling for background ingestion status.
- `/instructor/review-queue/`: Review queue filterable by status and trigger reasons.
- `/instructor/review-queue/$reviewCaseId`: Detailed triage viewer with full conversation context and resolution actions (**Approve Original**, **Inline Edit**, **Replace with Fresh Guidance**, or **Reject Request**).

### 3. Admin workspace (`/admin`, requires `ADMIN` role)
- `/admin/`: System-wide metrics, quick actions, and recent audit activity feed.
- `/admin/users/students` & `/admin/users/instructors`: Paginated user tables, status toggles (Active/Disabled), password reset dialog, and CSV bulk user import via PapaParse.
- `/admin/courses/`: Course creation, editing, and archiving.
- `/admin/assignments/`: Individual and bulk multi-course student and instructor enrollment.
- `/admin/materials/`: System-wide course material oversight, chunk inspection, and error reporting.
- `/admin/audit/`: Structured security and operational audit trail viewer.

### 4. Auth and public routes
- `/`: Public landing page with the Socratic learning method, curriculum overview, and sign-in CTA.
- `/login`: Institutional sign-in form with demo account autofill pills.
- `/settings`, `/instructor/settings`, `/admin/settings`: Profile details, light/dark mode switch, and 6 institutional color palettes.

---

## State management and API integration

- **Authentication session (`useAuthStore`)**: Zustand store managing active user state, access token lifetime, and automatic token refresh deduplication.
- **Authenticated fetch client (`authenticated-api-client.ts`)**: Wraps native `fetch` to automatically append `Authorization: Bearer <token>` headers. Intercepts `401 Unauthorized` responses to call `/api/v1/auth/refresh` using the HttpOnly cookie and replay pending requests.
- **Data fetching (`TanStack Query v5`)**:
  - `useQuery` and `useInfiniteQuery` for server data synchronization, caching, and cursor pagination.
  - Optimistic UI updates on chat message submission (`useSendChatMessage`) and retries (`useRetryChatMessage`).
  - Polling with `refetchInterval: 2000ms` while course materials are in `PROCESSING` status.

---

## UI design system

- **Styling**: Tailwind CSS v4 with unified design tokens (IBM Plex typography, color palettes, border radii).
- **Primitives**: Radix UI and `@base-ui/react` headless components wrapped in shadcn/ui conventions.
- **Icons**: Lucide React icons.
- **Theme and appearance**: Light, Dark, and System modes with 6 institutional color themes (`Morshid`, `Ocean Mist`, `Slate Blue`, `Lavender Gray`, `Soft Mint`, `Dusk`) using the browser **View Transitions API** with radial clip-path transitions.

---

## Available scripts

From the repository root or within the `client/` directory:

```bash
# Start Vite development server on port 3000
npm run dev

# Generate TanStack route tree (runs automatically in dev/build)
npm run generate-routes

# Run Vitest unit and component tests
npm test

# Run TypeScript typecheck
npm run typecheck

# Run ESLint check
npm run lint

# Format code with Prettier
npm run format
```
