import { applyDecorators } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import { OpenApiErrorDto } from './openapi-error.dto'

export function ApiAccessTokenAuth() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiUnauthorizedResponse({
      type: OpenApiErrorDto,
      description: 'The access token is missing, malformed, or invalid.',
    }),
    ApiForbiddenResponse({
      type: OpenApiErrorDto,
      description: 'The account is disabled or lacks the required role.',
    }),
  )
}
