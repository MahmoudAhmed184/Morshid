import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'

import { getRequestContext } from '../../common/http/request-context'
import { AUTH_ERROR_CODES } from '../auth/auth.dto'
import type { AuthenticatedRequestUser } from '../auth/auth.dto'
import { StudentChatService } from './student-chat.service'

interface RoleProtectedHttpRequest extends Request {
  user?: AuthenticatedRequestUser
}

/**
 * Audits role-guard denials on the Student-only chat endpoints.
 *
 * The class-level `@Roles(UserRole.STUDENT)` gate is enforced by the global
 * `RolesGuard`, which rejects a non-Student (e.g. an Instructor) before the
 * controller — and therefore before any chat-scoped membership/ownership audit
 * — ever runs. A controller-scoped exception filter still sees exceptions
 * thrown by that guard, so this records the denial without changing the 403
 * semantics: the original response is re-emitted verbatim, and the audit write
 * is best-effort so an audit failure can never turn a 403 into a 500.
 */
@Catch(ForbiddenException)
export class StudentChatRoleDenialAuditFilter implements ExceptionFilter {
  private readonly logger = new Logger(StudentChatRoleDenialAuditFilter.name)

  constructor(private readonly studentChatService: StudentChatService) {}

  async catch(
    exception: ForbiddenException,
    host: ArgumentsHost,
  ): Promise<void> {
    const httpContext = host.switchToHttp()
    const request = httpContext.getRequest<RoleProtectedHttpRequest>()
    const response = httpContext.getResponse<Response>()

    if (isInsufficientRoleDenial(exception)) {
      try {
        const courseId = readCourseIdParam(request)

        await this.studentChatService.recordRoleAccessDenied(
          courseId,
          request.user?.id ?? null,
          getRequestContext(request),
        )
      } catch (error) {
        // A role denial must remain a 403 even if auditing fails.
        this.logger.error(
          'Failed to record student chat role-denied audit event',
          error instanceof Error ? error.stack : undefined,
        )
      }
    }

    // Re-emit the original 403 unchanged (identical to the default handler for
    // an object-bodied HttpException).
    response.status(exception.getStatus()).json(exception.getResponse())
  }
}

function isInsufficientRoleDenial(exception: ForbiddenException): boolean {
  const body = exception.getResponse()

  return (
    typeof body === 'object' &&
    'code' in body &&
    (body as { code?: unknown }).code === AUTH_ERROR_CODES.INSUFFICIENT_ROLE
  )
}

function readCourseIdParam(request: RoleProtectedHttpRequest): string | null {
  const courseId = (request.params as Record<string, string | undefined>)
    .courseId

  return typeof courseId === 'string' ? courseId : null
}
