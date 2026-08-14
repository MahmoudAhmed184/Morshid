import type { Request } from 'express'

export interface RequestContext {
  ip?: string | null
  userAgent?: string | null
}

export function getRequestContext(request: Request): RequestContext {
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
