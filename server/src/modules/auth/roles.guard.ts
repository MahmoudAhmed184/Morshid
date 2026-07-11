import { Injectable } from '@nestjs/common'
import type { CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

import {
  getAuditRequestContext,
  getRouteContext,
} from '../../common/http-request-context'
import type { UserRole } from '../../generated/prisma/client'
import { AccessAuditService } from '../audit/access-audit.service'
import type { AuthenticatedRequestUser } from './auth.dto'
import { insufficientRoleException } from './auth.errors'
import { ROLES_KEY } from './roles.decorator'

interface RoleProtectedHttpRequest extends Request {
  user?: AuthenticatedRequestUser
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
      await this.accessAuditService.recordRbacDenied({
        actor: request.user
          ? {
              id: request.user.id,
              role: request.user.role,
            }
          : null,
        allowedRoles,
        route: getRouteContext(request),
        requestContext: getAuditRequestContext(request),
      })
      throw insufficientRoleException()
    }

    return true
  }
}
