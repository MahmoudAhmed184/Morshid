# 06. API structure and client-server communication

Morshid exposes a REST API under the `/api/v1/` prefix. OpenAPI 3.0 annotations document every endpoint, and Zod schemas validate request and response payloads at runtime.

---

## 1. Complete API route map

```
/api/v1
├── /auth
│   ├── POST   /sign-in          # Authenticate email & password -> JWT + Refresh Cookie (@Public)
│   ├── POST   /refresh          # Rotate refresh token -> new JWT + new Refresh Cookie (@Public)
│   └── POST   /logout           # Revoke active refresh session & clear cookie (@Public)
├── /me                          # Get current authenticated user profile
├── /health                      # (Mounted at root /health)
│   ├── GET    /live             # Liveness probe: process uptime & memory status (@Public)
│   └── GET    /ready            # Readiness probe: PostgreSQL, Redis, pgvector check (@Public)
├── /admin
│   ├── /users
│   │   ├── GET    /             # List users with filtering, cursor pagination, and stats (ADMIN)
│   │   ├── POST   /             # Create single user account (ADMIN)
│   │   ├── POST   /bulk         # Bulk import users (1 to 200) atomically (ADMIN)
│   │   ├── PATCH  /:userId      # Update user profile or role (ADMIN)
│   │   ├── PATCH  /:userId/disable     # Disable user account & revoke refresh tokens (ADMIN)
│   │   ├── PATCH  /:userId/reactivate  # Reactivate disabled user account (ADMIN)
│   │   └── PATCH  /:userId/reset-password # Reset user password & revoke sessions (ADMIN)
│   ├── /courses
│   │   ├── GET    /             # List all courses with pagination & search (ADMIN)
│   │   ├── POST   /             # Create course (ADMIN)
│   │   ├── GET    /:courseId    # Get course details & membership list (ADMIN)
│   │   ├── PATCH  /:courseId    # Update course title / code (ADMIN)
│   │   ├── DELETE /:courseId    # Archive course and soft-delete materials (ADMIN)
│   │   ├── POST   /:courseId/members       # Add instructor/student member (ADMIN)
│   │   ├── POST   /members/bulk            # Bulk assign users to courses (ADMIN)
│   │   ├── DELETE /:courseId/members/:userId # Remove user from course (ADMIN)
│   │   └── PATCH  /:courseId/members/:userId # Update member role (ADMIN)
│   └── /audit
│       └── GET    /             # Query system audit logs with filters (ADMIN)
├── /courses
│   ├── GET    /                 # List courses accessible to the authenticated user
│   ├── GET    /material-management # List courses where user is Instructor (INSTRUCTOR)
│   └── /:courseId
│       ├── /materials
│       │   ├── GET    /         # List materials and processing status for course
│       │   ├── POST   /         # Upload PDF material (multipart/form-data) (INSTRUCTOR)
│       │   ├── GET    /:materialId # Get material status and details
│       │   └── DELETE /:materialId # Soft-delete course material (INSTRUCTOR / ADMIN)
│       └── /chat-sessions
│           ├── GET    /         # Get or list chat sessions for enrolled student (STUDENT)
│           ├── POST   /         # Start or resume active chat session (STUDENT)
│           └── /:sessionId/messages
│               ├── GET    /     # Retrieve paginated conversation history & citations (STUDENT)
│               └── POST   /     # Submit Socratic question/code turn -> Tutoring Runtime (STUDENT)
├── /materials
│   └── GET    /upload-configuration # Get maximum upload size and allowed MIME types (INSTRUCTOR)
├── /messages
│   └── POST   /:messageId/review-requests # Student requests instructor review on message (STUDENT)
├── /instructor
│   └── /reviews
│       ├── GET    /             # Get pending review queue for assigned courses (INSTRUCTOR)
│       ├── POST   /:reviewCaseId/resolve # Resolve review: outcome, content, reason (INSTRUCTOR)
│       └── POST   /:reviewCaseId/reject  # Dismiss review request with reason (INSTRUCTOR)
└── /reviews
    └── /inbox
        ├── GET    /             # List student's review inbox items & resolutions (STUDENT)
        └── POST   /:inboxItemId/read # Mark student review inbox item as read (STUDENT)
```

---

## 2. Request and response contracts

### 2.1 Authentication DTOs
```typescript
// POST /api/v1/auth/sign-in Request
export interface SignInRequestDto {
  email: string      // Valid email string
  password: string   // Raw user password
}

// Response
export interface IdentitySessionResponseDto {
  tokenType: 'Bearer'
  accessToken: string
  accessTokenExpiresAt: string
  user: {
    id: string
    email: string
    displayName: string
    role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT'
    status: 'ACTIVE' | 'DISABLED'
  }
}
```

### 2.2 Socratic tutoring turn DTOs
```typescript
// POST /api/v1/courses/:courseId/chat-sessions/:sessionId/messages Request
export interface SendTutoringMessageRequestDto {
  clientMessageId: string       // UUID v4 for idempotency
  content: string               // Student question or code inquiry (max 4,000 chars)
  problemId?: string            // Optional problem scope
  conceptId?: string            // Optional concept scope
  title?: string                // Optional message title
}

// Response (TutoringTurnResponseDto)
export interface TutoringTurnResponseDto {
  studentMessage: ChatMessageDto
  assistantMessage: ChatMessageDto
}

export interface ChatMessageDto {
  id: string
  sessionId: string
  courseId: string
  sequence: number
  role: 'STUDENT' | 'ASSISTANT'
  status: 'PENDING' | 'COMPLETED' | 'FAILED'
  content: string
  guidanceLabel?: 'COURSE_GROUNDED' | 'DIRECT_GUIDANCE' | 'SAFE_FALLBACK'
  hintLevel?: number
  citations: Array<{
    materialId: string
    materialTitle: string
    evidence: Array<{
      rank: number
      similarityScore: number
      chunkId: string
      chunkNumber: number
      excerpt: string
    }>
  }>
  reviewSummary?: {
    caseId: string
    status: 'OPEN' | 'RESOLVED' | 'DISMISSED'
    outcome?: 'APPROVED' | 'EDITED' | 'REPLACED' | 'REQUEST_REJECTED'
  }
  createdAt: string
}
```

### 2.3 Review resolution DTOs
```typescript
// POST /api/v1/instructor/reviews/:reviewCaseId/resolve Request
// Header: Idempotency-Key: <uuid>
export interface ResolveReviewRequestDto {
  expectedVersion: number       // Optimistic concurrency control
  outcome: 'APPROVED' | 'EDITED' | 'REPLACED'
  content: string | null        // Revised assistant guidance (required if EDITED / REPLACED)
  reason?: string | null        // Pedagogical rationale
}

// POST /api/v1/instructor/reviews/:reviewCaseId/reject Request
// Header: Idempotency-Key: <uuid>
export interface RejectReviewRequestDto {
  expectedVersion: number
  reason: string                // Explanation for dismissal
}
```

---

## 3. OpenAPI and Swagger specification

- **Interactive UI.** `http://localhost:4000/docs`
- **JSON specification.** `http://localhost:4000/docs-json`
- **YAML specification.** `http://localhost:4000/docs-yaml`

### Security schemes

- **`access-token`.** HTTP Bearer JWT passed in the `Authorization: Bearer <token>` header.
- **`refresh-session`.** HTTP-only cookie named `morshid_refresh`, scoped to `/api/v1/auth`.

---

## 4. Error handling and status code conventions

| Status code | Meaning | Common triggers |
|---|---|---|
| **`200 OK`** | Successful query or mutation | `GET /courses`, `PATCH /users/:id`, `POST /auth/sign-in` |
| **`201 Created`** | Successful entity creation | `POST /courses/:courseId/chat-sessions/:sessionId/messages`, `POST /admin/courses`, `POST /courses/:courseId/materials` |
| **`204 No Content`** | Successful action with empty body | `POST /auth/logout`, `DELETE /admin/courses/:courseId` |
| **`400 Bad Request`** | Validation failure or malformed parameter | Invalid Zod request payload, invalid UUID parameter |
| **`401 Unauthorized`** | Authentication failure | Expired JWT, invalid password, missing token |
| **`403 Forbidden`** | Authorization or RBAC failure | Non-admin calling `/admin/*`, student not enrolled in course |
| **`404 Not Found`** | Resource missing | Course, material, or user does not exist |
| **`409 Conflict`** | Duplicate key or state conflict | Duplicate email, duplicate course code, role change on enrolled user |
| **`422 Unprocessable`** | Domain rule violation | Uploading non-PDF file, submitting turn to unindexed course |
| **`503 Unavailable`** | Upstream service or database down | `/health/ready` probe failed, Redis disconnected |
