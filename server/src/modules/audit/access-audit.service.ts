import { Injectable } from '@nestjs/common'

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
  constructor(private readonly auditService: AuditService) {}

  async recordRbacDenied(input: {
    actor?: AccessAuditActor | null
    allowedRoles: UserRole[]
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
        },
        requestContext: input.requestContext,
      })
    } catch {
      // Audit failures must not change authorization responses.
    }
  }
}
