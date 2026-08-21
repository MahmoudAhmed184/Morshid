import {
  BadRequestException,
  ClassSerializerInterceptor,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  SerializeOptions,
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger'

import { ApiAccessTokenAuth } from '../../common/http/openapi.decorators'
import {
  NestBadRequestErrorDto,
  OpenApiErrorDto,
  OpenApiIssuesErrorDto,
} from '../../common/http/openapi-error.dto'
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe'
import type { AuthenticatedHttpRequest } from '../identity/identity.guard'
import { AuditService } from './audit.service'
import { Roles, UserRole } from '../identity/identity.roles'
import {
  AuditEventDto,
  AuditEventListResponseDto,
  auditListQuerySchema,
  type AuditListQuery,
} from './audit.types'

@Controller('admin/audit')
@ApiTags('audit')
@Roles(UserRole.ADMIN)
@ApiAccessTokenAuth()
@ApiExtraModels(NestBadRequestErrorDto, OpenApiErrorDto)
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
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<AuditEventListResponseDto> {
    const universityId = request.user.universityId
    if (universityId === null) {
      throw new ForbiddenException('Actor must belong to a university')
    }
    const page = await this.auditService.listAuditEvents({
      ...query,
      universityId,
    })
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

  @Get(':id')
  @SerializeOptions({
    type: AuditEventDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Get audit event details by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    type: AuditEventDto,
    description: 'Audit event details.',
  })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  async getEventById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<AuditEventDto> {
    const universityId = request.user.universityId
    if (universityId === null) {
      throw new ForbiddenException('Actor must belong to a university')
    }
    const event = await this.auditService.findEventById(id, universityId)
    if (event === null) {
      throw new NotFoundException({
        code: 'AUDIT_EVENT_NOT_FOUND',
        message: `Audit event ${id} not found`,
      })
    }
    return {
      ...event,
      createdAt: event.createdAt.toISOString(),
    }
  }
}
