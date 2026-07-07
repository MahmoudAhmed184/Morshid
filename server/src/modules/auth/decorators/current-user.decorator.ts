import { createParamDecorator } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'

import type { AuthenticatedUser } from '../auth.service'
import type { AuthenticatedRequest } from '../guards/jwt-access.guard'

export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()

    if (field === undefined) {
      return request.user
    }

    return request.user?.[field]
  },
)
