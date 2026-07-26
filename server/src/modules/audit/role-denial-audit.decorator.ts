import { SetMetadata } from '@nestjs/common'

import type { AuditEventAction, AuditTargetType } from './audit.constants'

export const ROLE_DENIAL_AUDIT_KEY = 'role-denial-audit'

export interface RoleDenialAuditMetadata {
  action: AuditEventAction
  targetType: AuditTargetType
  reason: string
}

export const AuditRoleDenial = (metadata: RoleDenialAuditMetadata) =>
  SetMetadata(ROLE_DENIAL_AUDIT_KEY, metadata)
