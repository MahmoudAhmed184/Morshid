import { Injectable, Logger } from '@nestjs/common'

import type { UserRole } from '../../generated/prisma/client'
import { AUDIT_EVENT_ACTIONS, AUDIT_TARGET_TYPES } from './audit.constants'
import type { AuditRequestContext } from './audit.service'
import { AuditService } from './audit.service'

export interface AccessAuditActor {
  id: string
  role: UserRole
}

export interface AccessAuditRouteContext {
  method: string
  path: string
}

@Injectable()
export class AccessAuditService {
  private readonly logger = new Logger(AccessAuditService.name)

  constructor(private readonly auditService: AuditService) {}

  async recordRbacDenied(input: {
    actor?: AccessAuditActor | null
    allowedRoles: UserRole[]
    /**
     * Raw course id from the request path, if any. It is never verified here, so
     * it is kept in unconstrained JSONB metadata (never the FK column) to stay
     * FK-safe and to avoid a course-existence oracle.
     */
    unverifiedCourseId?: string | null
    route: AccessAuditRouteContext
    requestContext: AuditRequestContext
  }): Promise<void> {
    try {
      await this.auditService.recordEvent({
        actorUserId: input.actor?.id ?? null,
        action: AUDIT_EVENT_ACTIONS.ACCESS_RBAC_DENIED,
        target: {
          type: AUDIT_TARGET_TYPES.SYSTEM,
        },
        metadata: {
          requiredRoles: input.allowedRoles,
          actorRole: input.actor?.role ?? null,
          method: input.route.method,
          path: input.route.path,
          ...(input.unverifiedCourseId === undefined ||
          input.unverifiedCourseId === null
            ? {}
            : { unverifiedCourseId: input.unverifiedCourseId }),
        },
        requestContext: input.requestContext,
      })
    } catch (error) {
      // Audit failures must not change authorization responses.
      this.logger.error(
        'Failed to record RBAC-denied audit event',
        error instanceof Error ? error.stack : undefined,
      )
    }
  }

  /**
   * Records a course-boundary denial (a caller reaching a course-scoped route
   * for a course they cannot access). Mirrors {@link recordRbacDenied}: it
   * carries the actor, the attempted operation (method/path), and the course,
   * and it is best-effort so a persistence outage never converts the original
   * 403 into a 500.
   */
  async recordCourseBoundaryDenied(input: {
    actor?: AccessAuditActor | null
    /**
     * Verified course id. Pass `null` when the course could not be confirmed to
     * exist so the audit row does not violate the `audit_logs.course_id` foreign
     * key; the raw value is preserved in `unverifiedCourseId`.
     */
    courseId: string | null
    /**
     * Raw, unverified course id from the request path. Stored in JSONB metadata
     * (which carries no foreign key) so the audit trail is never lost for a
     * denial that references a non-existent course.
     */
    unverifiedCourseId?: string | null
    route: AccessAuditRouteContext
    requestContext: AuditRequestContext
  }): Promise<void> {
    try {
      await this.auditService.recordEvent({
        actorUserId: input.actor?.id ?? null,
        action: AUDIT_EVENT_ACTIONS.ACCESS_COURSE_BOUNDARY_DENIED,
        target: {
          type: AUDIT_TARGET_TYPES.COURSE,
          id: input.courseId,
        },
        courseId: input.courseId,
        metadata: {
          actorRole: input.actor?.role ?? null,
          method: input.route.method,
          path: input.route.path,
          operation: `${input.route.method} ${input.route.path}`,
          ...(input.unverifiedCourseId === undefined ||
          input.unverifiedCourseId === null
            ? {}
            : { unverifiedCourseId: input.unverifiedCourseId }),
        },
        requestContext: input.requestContext,
      })
    } catch (error) {
      // Audit failures must not change authorization responses.
      this.logger.error(
        'Failed to record course-boundary-denied audit event',
        error instanceof Error ? error.stack : undefined,
      )
    }
  }
}
