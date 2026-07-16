import {
  BadRequestException,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Query,
  SerializeOptions,
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger'

import { ApiAccessTokenAuth } from '../../../common/http/openapi.decorators'
import { OpenApiIssuesErrorDto } from '../../../common/http/openapi-error.dto'
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe'
import { UserRole } from '../../../generated/prisma/client'
import { AuditService } from '../../audit/audit.service'
import { Roles } from '../../auth/roles.decorator'
import {
  AdminAuditEventListResponseDto,
  adminAuditListQuerySchema,
  type AdminAuditListQuery,
} from './admin-audit.dto'

@Controller('admin/audit')
@ApiTags('admin-audit')
@Roles(UserRole.ADMIN)
@ApiAccessTokenAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class AdminAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @SerializeOptions({
    type: AdminAuditEventListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List recent audit events' })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 20,
    },
  })
  @ApiOkResponse({
    type: AdminAuditEventListResponseDto,
    description: 'Recent audit events in reverse chronological order.',
  })
  @ApiBadRequestResponse({ type: OpenApiIssuesErrorDto })
  async listRecentEvents(
    @Query(
      new ZodValidationPipe(
        adminAuditListQuerySchema,
        (issues) =>
          new BadRequestException({
            code: 'INVALID_REQUEST',
            message: 'Invalid audit query',
            issues: issues.map((issue) => ({
              field: issue.path.join('.') || 'query',
              message: issue.message,
            })),
          }),
      ),
    )
    query: AdminAuditListQuery,
  ): Promise<AdminAuditEventListResponseDto> {
    const events = await this.auditService.listRecentEvents(query.limit)
    return {
      events: events.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
    }
  }
}
