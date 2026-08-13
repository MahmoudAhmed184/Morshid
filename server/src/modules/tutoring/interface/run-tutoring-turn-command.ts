import type { AuditRequestContext } from '../../audit/audit.public'
import type { RequestBudget } from '../../../common/http/request-deadline'

export type RunTutoringTurnCommand =
  | {
      readonly kind: 'new'
      readonly courseId: string
      readonly sessionId: string
      readonly studentId: string
      readonly clientMessageId: string
      readonly content: string
      readonly problemId?: string
      readonly conceptId?: string
      readonly title?: string
      readonly requestContext?: AuditRequestContext
      readonly requestBudget?: RequestBudget
    }
  | {
      readonly kind: 'retry'
      readonly courseId: string
      readonly sessionId: string
      readonly studentId: string
      readonly attemptId: string
      readonly requestContext?: AuditRequestContext
      readonly requestBudget?: RequestBudget
    }
