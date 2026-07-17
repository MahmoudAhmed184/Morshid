import type { Request } from 'express'

import type { AuditRequestContext } from '../../modules/audit/audit.service'

export function getRequestContext(request: Request): AuditRequestContext {
  return {
    ip: request.ip ?? null,
    userAgent: request.get('user-agent') ?? null,
  }
}

export function getRouteContext(request: Request): {
  method: string
  path: string
} {
  return {
    method: request.method,
    path:
      (request.route as { path?: string } | undefined)?.path ?? request.path,
  }
}
