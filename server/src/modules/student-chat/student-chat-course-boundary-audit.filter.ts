import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'

import {
  getRequestContext,
  getRouteContext,
} from '../../common/http/request-context'
import type { AccessAuditActor } from '../audit/access-audit.service'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import { STUDENT_CHAT_ERROR_CODES } from './student-chat.errors'
import { StudentChatService } from './student-chat.service'

interface CourseScopedHttpRequest extends Request {
  user?: AuthenticatedRequestUser
}

/**
 * Audits course-boundary denials on the course-scoped chat endpoints.
 *
 * A Student who is not an active member of `:courseId` is rejected with a 403
 * thrown from deep inside `StudentChatService`. This controller-scoped filter
 * still sees that exception with the full request context (actor, route, ip,
 * user-agent, course id), so it emits the generic
 * `ACCESS_COURSE_BOUNDARY_DENIED` audit event (Issue #15) without changing the
 * 403 semantics: the original response is re-emitted verbatim and the audit
 * write is best-effort so an audit failure can never turn a 403 into a 500.
 *
 * Role denials (a non-Student reaching these Student-only endpoints) are NOT
 * handled here — the global `RolesGuard` already emits `ACCESS_RBAC_DENIED`
 * for every role denial, so auditing them again here would double-count.
 */
@Catch(ForbiddenException)
export class StudentChatCourseBoundaryAuditFilter implements ExceptionFilter {
  private readonly logger = new Logger(
    StudentChatCourseBoundaryAuditFilter.name,
  )

  constructor(private readonly studentChatService: StudentChatService) {}

  async catch(
    exception: ForbiddenException,
    host: ArgumentsHost,
  ): Promise<void> {
    const httpContext = host.switchToHttp()
    const request = httpContext.getRequest<CourseScopedHttpRequest>()
    const response = httpContext.getResponse<Response>()

    if (isCourseBoundaryDenial(exception)) {
      try {
        await this.studentChatService.recordCourseBoundaryDenied(
          readCourseIdParam(request),
          readActor(request),
          getRouteContext(request),
          getRequestContext(request),
        )
      } catch (error) {
        // A course-boundary denial must remain a 403 even if auditing fails.
        this.logger.error(
          'Failed to record student chat course-boundary-denied audit event',
          error instanceof Error ? error.stack : undefined,
        )
      }
    }

    // Re-emit the original 403 unchanged (identical to the default handler for
    // an object-bodied HttpException).
    response.status(exception.getStatus()).json(exception.getResponse())
  }
}

function isCourseBoundaryDenial(exception: ForbiddenException): boolean {
  const body = exception.getResponse()

  return (
    typeof body === 'object' &&
    'code' in body &&
    (body as { code?: unknown }).code ===
      STUDENT_CHAT_ERROR_CODES.ACTIVE_STUDENT_MEMBERSHIP_REQUIRED
  )
}

function readActor(request: CourseScopedHttpRequest): AccessAuditActor | null {
  return request.user ? { id: request.user.id, role: request.user.role } : null
}

function readCourseIdParam(request: CourseScopedHttpRequest): string | null {
  const courseId = (request.params as Record<string, string | undefined>)
    .courseId

  return typeof courseId === 'string' ? courseId : null
}
