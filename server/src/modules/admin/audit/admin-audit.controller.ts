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
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger'

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
@ApiBearerAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class AdminAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @SerializeOptions({
    type: AdminAuditEventListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiQuery({ name: 'limit', required: false, minimum: 1, maximum: 100 })
  @ApiOkResponse({ type: AdminAuditEventListResponseDto })
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
