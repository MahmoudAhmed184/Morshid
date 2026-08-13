import { Injectable } from '@nestjs/common'

import { AUDIT_EVENT_ACTIONS, AUDIT_TARGET_TYPES } from '../audit/audit.public'
import { AuditService, type AuditRequestContext } from '../audit/audit.public'
import type { DatabaseTransaction } from '../../platform/database/database-transaction'
import type { CourseMembershipRole } from './interface/course-membership-role'

interface RecordCourseCreatedInput {
  actorUserId: string
  course: {
    id: string
    code: string
    title: string
  }
  requestContext?: AuditRequestContext
}

interface RecordCourseUpdatedInput {
  actorUserId: string
  course: {
    id: string
    code: string
    title: string
  }
  previousCourse: {
    code: string
    title: string
  }
  requestContext?: AuditRequestContext
}

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

@Injectable()
export class CourseAudit {
  constructor(private readonly auditService: AuditService) {}

  async recordCourseCreated(
    input: RecordCourseCreatedInput,
    transaction?: DatabaseTransaction,
  ): Promise<void> {
    await this.auditService.recordEvent(
      {
        actorUserId: input.actorUserId,
        action: AUDIT_EVENT_ACTIONS.ADMIN_COURSE_CREATED,
        target: {
          type: AUDIT_TARGET_TYPES.COURSE,
          id: input.course.id,
        },
        courseId: input.course.id,
        metadata: {
          code: input.course.code,
          title: input.course.title,
        },
        requestContext: input.requestContext,
      },
      transaction,
    )
  }

  async recordCourseUpdated(
    input: RecordCourseUpdatedInput,
    transaction?: DatabaseTransaction,
  ): Promise<void> {
    await this.auditService.recordEvent(
      {
        actorUserId: input.actorUserId,
        action: AUDIT_EVENT_ACTIONS.ADMIN_COURSE_UPDATED,
        target: {
          type: AUDIT_TARGET_TYPES.COURSE,
          id: input.course.id,
        },
        courseId: input.course.id,
        metadata: {
          before: {
            code: input.previousCourse.code,
            title: input.previousCourse.title,
          },
          after: {
            code: input.course.code,
            title: input.course.title,
          },
          changedFields: ['code', 'title'].filter(
            (field) =>
              input.previousCourse[
                field as keyof typeof input.previousCourse
              ] !== input.course[field as 'code' | 'title'],
          ),
        },
        requestContext: input.requestContext,
      },
      transaction,
    )
  }

  async recordMemberAdded(
    input: RecordMemberAddedInput,
    transaction?: DatabaseTransaction,
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
      transaction,
    )
  }

  async recordMemberRemoved(
    input: RecordMemberRemovedInput,
    transaction?: DatabaseTransaction,
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
      transaction,
    )
  }

  async recordMemberRoleChanged(
    input: RecordMemberRoleChangedInput,
    transaction?: DatabaseTransaction,
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
      transaction,
    )
  }
}
