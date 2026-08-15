# 18. Extension guide: recipes for common changes

Step-by-step recipes for common changes in Morshid that keep architecture boundaries, type contracts, and quality gates intact.

---

## Recipe 1: Add a backend endpoint

When adding an endpoint to an existing capability module (such as `courses`):

### Step 1: Define the DTO and Zod validation schema
Create or update the DTO file (`server/src/modules/courses/courses.dto.ts`):
```typescript
import { z } from 'zod'

export const updateCourseTitleSchema = z.object({
  title: z.string().trim().min(3).max(160),
})

export type UpdateCourseTitleDto = z.infer<typeof updateCourseTitleSchema>
```

### Step 2: Implement repository and service logic
1. Update the repository interface and implementation (`courses.repository.ts`):
   ```typescript
   async updateTitle(courseId: string, title: string, tx?: DatabaseTransaction): Promise<Course>
   ```
2. Update the domain service (`courses.service.ts`):
   - Inject dependencies in the constructor.
   - Enforce business logic and permission checks (`CourseAccess`).

### Step 3: Implement the controller route handler
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

### Step 4: Verify architecture boundaries
Run `npm run test:architecture:server` to verify that no cross-module imports were introduced.

---

## Recipe 2: Add a database entity or field

Morshid defines schemas in domain `.prisma` files under `server/prisma/` ([ADR 0004](file:///home/mahmoud-ahmed/Projects/Morshid/docs/adr/0004-clean-slate-prisma-migration.md)).

### Step 1: Update the domain Prisma file
Add your model or field to the corresponding domain file, such as `server/prisma/courses-and-materials.prisma`:
```prisma
model Course {
  // Existing fields...
  syllabusSummary String? @map("syllabus_summary") @db.Text
}
```

### Step 2: Regenerate the Prisma client
```bash
npm run db:generate --workspace server
```

### Step 3: Update migration and semantic catalog
Because Morshid uses a clean-slate migration strategy during development:
1. Regenerate the clean-slate migration or create a development migration.
2. Run the catalog assertion to inspect schema changes:
   ```bash
   npm run db:assert-catalog
   ```
3. Update the expected fingerprint in `server/prisma/assert-catalog.mts` if structural constraints or columns changed intentionally.

---

## Recipe 3: Add a client feature and route

### Step 1: Create the feature module
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

### Step 2: Export the public interface
In `client/src/features/course-announcements/interface/index.ts`:
```typescript
export { useAnnouncements } from '../hooks/use-announcements'
export type { CourseAnnouncement } from '../schemas/announcement.schema'
```

### Step 3: Compose in a role workspace
Import from the public interface into the appropriate workspace (for example, `client/src/workspaces/student/`):
```typescript
import { useAnnouncements } from '@/features/course-announcements/interface'
```

### Step 4: Add a thin route file
In `client/src/routes/`:
```typescript
// client/src/routes/_student.announcements.tsx
import { createFileRoute } from '@tanstack/react-router'
import { StudentAnnouncementsView } from '@/workspaces/student/announcements-view'

export const Route = createFileRoute('/_student/announcements')({
  component: StudentAnnouncementsView,
})
```

### Step 5: Update the generated route tree
```bash
npm run generate-routes --workspace client
```

---

## Recipe 4: Add a Socratic guardrail or safety rule

When adding a pedagogical constraint to the Socratic tutoring engine:

### Step 1: Update the fixed teaching guard policy
In [`server/src/modules/tutoring/socratic-workflow/teaching-decision/teaching-policy.selector.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/teaching-decision/teaching-policy.selector.ts):
```typescript
export const fixedGuardPolicy = {
  // Existing rules...
  preventPseudocodeExecution: true,
}
```

### Step 2: Add a deterministic regex rule
In [`server/src/modules/tutoring/socratic-workflow/response-approval/deterministic-guard.service.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/response-approval/deterministic-guard.service.ts):
```typescript
// Add regex detector for forbidden patterns (e.g. executable pseudocode blocks)
const FORBIDDEN_PATTERN = /(?:execute|eval)\s*\(.*?\)/i
if (FORBIDDEN_PATTERN.test(candidateResponse.message)) {
  return { approved: false, reason: 'EXECUTABLE_PSEUDOCODE_DETECTED' }
}
```

### Step 3: Update the semantic guard prompt
In [`server/src/modules/tutoring/socratic-workflow/response-approval/semantic-guard.prompt.ts`](file:///home/mahmoud-ahmed/Projects/Morshid/server/src/modules/tutoring/socratic-workflow/response-approval/semantic-guard.prompt.ts):
- Add evaluation criteria to the guard model prompt instructing it to flag the new violation category.

### Step 4: Add unit and E2E regression tests
Add a targeted test in `server/src/modules/tutoring/socratic-workflow/response-approval/response-approval.service.spec.ts` to verify that candidate responses triggering this violation are rejected and regenerated.
