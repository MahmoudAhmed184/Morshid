import type { Request } from 'express'

import type { AuditRequestContext } from '../modules/audit/audit.service'

export function getAuditRequestContext(request: Request): AuditRequestContext {
  return {
    ip: request.ip ?? null,
    userAgent: request.get('user-agent') ?? null,
  }
}

export function getRouteContext(request: Request) {
  return {
    method: request.method,
    path: (request.route as { path?: string } | undefined)?.path ?? request.path,
  }
}
