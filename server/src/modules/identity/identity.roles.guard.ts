import { Injectable } from '@nestjs/common'
import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import {
  getRequestContext,
  getRouteContext,
} from '../../common/http/request-context'
import type { UserRole } from './identity.roles'
import { AccessAuditService } from '../audit/audit.public'
import {
  ROLE_DENIAL_AUDIT_KEY,
  type RoleDenialAuditMetadata,
} from '../audit/audit.public'
import type { AuthenticatedUser } from './identity.types'
import { insufficientRoleException } from './identity.errors'
import { ROLES_KEY } from './identity.roles'

interface RoleProtectedHttpRequest extends Request {
  user?: AuthenticatedUser
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessAuditService: AccessAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowedRoles = this.reflector.getAllAndOverride<
      UserRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()])

    if (allowedRoles === undefined) {
      return true
    }

    const request = context
      .switchToHttp()
      .getRequest<RoleProtectedHttpRequest>()

    if (
      request.user === undefined ||
      !allowedRoles.includes(request.user.role)
    ) {
      const roleDenialAudit = this.reflector.getAllAndOverride<
        RoleDenialAuditMetadata | undefined
      >(ROLE_DENIAL_AUDIT_KEY, [context.getHandler(), context.getClass()])
      const actor = request.user
        ? {
            id: request.user.id,
            role: request.user.role,
          }
        : null
      const unverifiedCourseId = readCourseIdParam(request)
      const route = getRouteContext(request)
      const requestContext = getRequestContext(request)

      await this.accessAuditService.recordRbacDenied({
        actor,
        allowedRoles,
        unverifiedCourseId,
        route,
        requestContext,
      })

      if (roleDenialAudit !== undefined) {
        await this.accessAuditService.recordRoleDeniedEvent({
          actor,
          audit: roleDenialAudit,
          unverifiedCourseId,
          route,
          requestContext,
        })
      }

      throw insufficientRoleException()
    }

    return true
  }
}

function readCourseIdParam(request: RoleProtectedHttpRequest): string | null {
  const courseId = (request.params as Record<string, string | undefined>)
    .courseId

  return typeof courseId === 'string' ? courseId : null
}
