import type {
  AccessAuditActor,
  AccessAuditRouteContext,
} from '../../audit/audit.public'
import type { AuditRequestContext } from '../../audit/audit.public'

export abstract class ConversationCourseBoundaryAudit {
  abstract recordCourseBoundaryDenied(
    courseId: string | null,
    actor: AccessAuditActor | null,
    route: AccessAuditRouteContext,
    requestContext: AuditRequestContext,
  ): Promise<void>
}
