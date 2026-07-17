import type { Request } from 'express'

export function getRequestContext(request: Request) {
  return {
    ip: request.ip ?? null,
    userAgent: request.get('user-agent') ?? null,
  }
}
