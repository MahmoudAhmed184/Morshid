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

import { ApiAccessTokenAuth } from '../../common/http/openapi.decorators'
import { OpenApiIssuesErrorDto } from '../../common/http/openapi-error.dto'
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe'
import { AuditService } from './audit.service'
import { Roles, UserRole } from '../identity/identity.roles'
import {
  AuditEventListResponseDto,
  auditListQuerySchema,
  type AuditListQuery,
} from './audit.types'

@Controller('admin/audit')
@ApiTags('audit')
@Roles(UserRole.ADMIN)
@ApiAccessTokenAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @SerializeOptions({
    type: AuditEventListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({
    summary: 'List recent audit events with search, filters, and pagination',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    schema: {
      type: 'integer',
      minimum: 1,
      default: 1,
    },
  })
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
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'targetType', required: false, type: String })
  @ApiQuery({ name: 'courseId', required: false, type: String })
  @ApiQuery({ name: 'actorUserId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiOkResponse({
    type: AuditEventListResponseDto,
    description: 'Recent audit events in reverse chronological order.',
  })
  @ApiBadRequestResponse({ type: OpenApiIssuesErrorDto })
  async listRecentEvents(
    @Query(
      new ZodValidationPipe(
        auditListQuerySchema,
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
    query: AuditListQuery,
  ): Promise<AuditEventListResponseDto> {
    const page = await this.auditService.listAuditEvents(query)
    return {
      events: page.events.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
      total: page.total,
      page: page.page,
      limit: page.limit,
      totalPages: page.totalPages,
    }
  }
}
