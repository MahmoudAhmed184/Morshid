import { Injectable } from '@nestjs/common'

import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../../audit/audit.constants'
import {
  AuditService,
  type AuditDatabase,
  type AuditRequestContext,
} from '../../audit/audit.service'
import type { CourseMembershipRole } from '../../../generated/prisma/client'

interface RecordMemberAddedInput {
  actorUserId: string
  courseId: string
  membership: {
    id: string
    userId: string
    role: CourseMembershipRole
    user: {
      email: string
      displayName: string
    }
  }
  requestContext?: AuditRequestContext
}

interface RecordMemberRemovedInput {
  actorUserId: string
  courseId: string
  membership: {
    id: string
    userId: string
    role: CourseMembershipRole
    user: {
      email: string
      displayName: string
    }
  }
  requestContext?: AuditRequestContext
}

interface RecordMemberRoleChangedInput {
  actorUserId: string
  courseId: string
  membership: {
    id: string
    userId: string
    role: CourseMembershipRole
    user: {
      email: string
      displayName: string
    }
  }
  requestContext?: AuditRequestContext
}

interface RecordMaterialUpdatedInput {
  actorUserId: string
  courseId: string
  material: {
    id: string
    title: string
  }
  requestContext?: AuditRequestContext
}

@Injectable()
export class AdminCoursesAuditService {
  constructor(private readonly auditService: AuditService) {}

  async recordMemberAdded(
    input: RecordMemberAddedInput,
    database?: AuditDatabase,
  ): Promise<void> {
    await this.auditService.recordEvent(
      {
        actorUserId: input.actorUserId,
        action: AUDIT_EVENT_ACTIONS.ADMIN_COURSE_MEMBER_ADDED,
        target: {
          type: AUDIT_TARGET_TYPES.COURSE_MEMBERSHIP,
          id: input.membership.id,
        },
        courseId: input.courseId,
        metadata: {
          userId: input.membership.userId,
          email: input.membership.user.email,
          displayName: input.membership.user.displayName,
          role: input.membership.role,
        },
        requestContext: input.requestContext,
      },
      database,
    )
  }

  async recordMemberRemoved(
    input: RecordMemberRemovedInput,
    database?: AuditDatabase,
  ): Promise<void> {
    await this.auditService.recordEvent(
      {
        actorUserId: input.actorUserId,
        action: AUDIT_EVENT_ACTIONS.ADMIN_COURSE_MEMBER_REMOVED,
        target: {
          type: AUDIT_TARGET_TYPES.COURSE_MEMBERSHIP,
          id: input.membership.id,
        },
        courseId: input.courseId,
        metadata: {
          userId: input.membership.userId,
          email: input.membership.user.email,
          displayName: input.membership.user.displayName,
          role: input.membership.role,
        },
        requestContext: input.requestContext,
      },
      database,
    )
  }

  async recordMemberRoleChanged(
    input: RecordMemberRoleChangedInput,
    database?: AuditDatabase,
  ): Promise<void> {
    await this.auditService.recordEvent(
      {
        actorUserId: input.actorUserId,
        action: AUDIT_EVENT_ACTIONS.ADMIN_COURSE_MEMBER_ROLE_CHANGED,
        target: {
          type: AUDIT_TARGET_TYPES.COURSE_MEMBERSHIP,
          id: input.membership.id,
        },
        courseId: input.courseId,
        metadata: {
          userId: input.membership.userId,
          email: input.membership.user.email,
          displayName: input.membership.user.displayName,
          role: input.membership.role,
        },
        requestContext: input.requestContext,
      },
      database,
    )
  }

  async recordMaterialUpdated(
    input: RecordMaterialUpdatedInput,
    database?: AuditDatabase,
  ): Promise<void> {
    await this.auditService.recordEvent(
      {
        actorUserId: input.actorUserId,
        action: AUDIT_EVENT_ACTIONS.ADMIN_COURSE_UPDATED,
        target: {
          type: AUDIT_TARGET_TYPES.MATERIAL,
          id: input.material.id,
        },
        courseId: input.courseId,
        metadata: {
          title: input.material.title,
        },
        requestContext: input.requestContext,
      },
      database,
    )
  }
}
