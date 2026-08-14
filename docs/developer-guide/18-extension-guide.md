# 18. Extension Guide: Common Developer Recipes

This guide provides concrete, step-by-step development recipes for making changes in Morshid while strictly maintaining architectural boundaries, typing contracts, and quality gates.

---

## Recipe 1: Adding a New Backend Endpoint

When adding an endpoint to an existing capability module (e.g. `Courses`):

### Step 1: Define DTO & Zod Validation Schema
Create or update the DTO file (`server/src/modules/courses/courses.dto.ts`):
```typescript
import { z } from 'zod'

export const updateCourseTitleSchema = z.object({
  title: z.string().trim().min(3).max(160),
})

export type UpdateCourseTitleDto = z.infer<typeof updateCourseTitleSchema>
```

### Step 2: Implement Repository & Service Logic
1. Update repository interface and implementation (`courses.repository.ts`):
   ```typescript
   async updateTitle(courseId: string, title: string, tx?: DatabaseTransaction): Promise<Course>
   ```
2. Update domain service (`courses.service.ts`):
   - Inject dependencies via NestJS constructor.
   - Enforce business logic and permission checks (`CourseAccess`).

### Step 3: Implement Controller Route Handler
In `server/src/modules/courses/courses.controller.ts`:
```typescript
@Patch(':courseId/title')
@Roles(UserRole.INSTRUCTOR, UserRole.ADMIN)
@ApiOperation({ summary: 'Update course title' })
@ApiResponse({ status: 200, type: CourseResponseDto })
async updateTitle(
  @Param('courseId', ParseUUIDPipe) courseId: string,
  @Body(new ZodValidationPipe(updateCourseTitleSchema, invalidPayloadException)) body: UpdateCourseTitleDto,
  @CurrentUser() user: AuthenticatedUser,
) {
  return this.coursesService.updateTitle(courseId, body.title, user)
}
```

### Step 4: Verify Architecture Boundaries
Run `npm run test:architecture:server` to verify no cross-module reaching occurred.

---

## Recipe 2: Adding a New Database Entity or Field

Morshid authors schemas in domain `.prisma` files under `server/prisma/` ([ADR 0004](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0004-clean-slate-prisma-migration.md)):

### Step 1: Update the Domain Prisma File
Add your model or field to the corresponding domain file (e.g. `server/prisma/courses-and-materials.prisma`):
```prisma
model Course {
  // Existing fields...
  syllabusSummary String? @map("syllabus_summary") @db.Text
}
```

### Step 2: Re-generate Prisma Client
```bash
npm run db:generate --workspace server
```

### Step 3: Update Migration & Semantic Catalog
Because Morshid is pre-deployment and uses a clean-slate migration strategy:
1. Re-generate the clean-slate migration or create a development migration.
2. Run catalog assertion to inspect schema changes:
   ```bash
   npm run db:assert-catalog
   ```
3. Update the expected fingerprint in `server/prisma/assert-catalog.mts` if structural constraints or columns were intentionally modified.

---

## Recipe 3: Adding a New Client Feature & Route

### Step 1: Create the Feature Module
Under `client/src/features/<feature-name>/`:
```
client/src/features/course-announcements/
├── api/
│   └── announcements.api.ts      # Fetch functions using apiClient
├── hooks/
│   └── use-announcements.ts      # TanStack Query query/mutation hooks
├── components/
│   └── announcement-card.tsx     # Feature-specific UI
├── schemas/
│   └── announcement.schema.ts    # Zod payload & response schemas
└── interface/
    └── index.ts                  # Public contract exposed to role workspaces
```

### Step 2: Export Public Interface
In `client/src/features/course-announcements/interface/index.ts`:
```typescript
export { useAnnouncements } from '../hooks/use-announcements'
export type { CourseAnnouncement } from '../schemas/announcement.schema'
```

### Step 3: Compose in Role Workspace
Import into the appropriate workspace (e.g. `client/src/workspaces/student/`):
```typescript
import { useAnnouncements } from '@/features/course-announcements/interface'
```

### Step 4: Add Thin Route File
In `client/src/routes/`:
```typescript
// client/src/routes/_student.announcements.tsx
import { createFileRoute } from '@tanstack/react-router'
import { StudentAnnouncementsView } from '@/workspaces/student/announcements-view'

export const Route = createFileRoute('/_student/announcements')({
  component: StudentAnnouncementsView,
})
```

### Step 5: Update Generated Route Tree
```bash
npm run generate-routes --workspace client
```

---

## Recipe 4: Adding a Socratic Guardrail or Safety Rule

When extending the Socratic tutoring engine with a new pedagogical constraint:

### Step 1: Update Fixed Teaching Guard Policy
In [`server/src/modules/tutoring/socratic-workflow/teaching-decision/teaching-policy.selector.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/teaching-decision/teaching-policy.selector.ts):
```typescript
export const fixedGuardPolicy = {
  // Existing rules...
  preventPseudocodeExecution: true,
}
```

### Step 2: Add Deterministic Regular Expression Rule
In [`server/src/modules/tutoring/socratic-workflow/response-approval/deterministic-guard.service.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/response-approval/deterministic-guard.service.ts):
```typescript
// Add regex detector for forbidden patterns (e.g. executable pseudocode blocks)
const FORBIDDEN_PATTERN = /(?:execute|eval)\s*\(.*?\)/i
if (FORBIDDEN_PATTERN.test(candidateResponse.message)) {
  return { approved: false, reason: 'EXECUTABLE_PSEUDOCODE_DETECTED' }
}
```

### Step 3: Update Semantic Guard System Prompt
In [`server/src/modules/tutoring/socratic-workflow/response-approval/semantic-guard.prompt.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/response-approval/semantic-guard.prompt.ts):
- Add explicit evaluation criteria to the guard model prompt instructing it to flag the new violation category.

### Step 4: Add Unit & E2E Regression Coverage
Add a targeted test case in `server/src/modules/tutoring/socratic-workflow/response-approval/response-approval.service.spec.ts` verifying that candidate responses triggering this violation are rejected and regenerated.
