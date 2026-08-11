import {
  BadRequestException,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  SerializeOptions,
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger'

import { ApiAccessTokenAuth } from '../../common/http/openapi.decorators'
import {
  OpenApiIssuesErrorDto,
  NestBadRequestErrorDto,
  OpenApiErrorDto,
} from '../../common/http/openapi-error.dto'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import type { AuthenticatedHttpRequest } from '../identity/identity.guard'
import {
  NotificationListResponseDto,
  notificationListQuerySchema,
  type NotificationListQuery,
  NotificationUnreadCountDto,
  StudentNotificationDto,
} from './notifications.dto'
import { NotificationsService } from './notifications.service'

@Controller('notifications')
@ApiTags('notifications')
@ApiAccessTokenAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @SerializeOptions({
    type: NotificationListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List notifications for the authenticated user' })
  @ApiQuery({ name: 'cursor', required: false, format: 'uuid' })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  })
  @ApiOkResponse({ type: NotificationListResponseDto })
  @ApiBadRequestResponse({ type: OpenApiIssuesErrorDto })
  list(
    @Query(
      new ZodValidationPipe(
        notificationListQuerySchema,
        notificationValidationException,
      ),
    )
    query: NotificationListQuery,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<NotificationListResponseDto> {
    return this.service.list(request.user, query)
  }

  @Get('unread-count')
  @SerializeOptions({
    type: NotificationUnreadCountDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Count unread notifications' })
  @ApiOkResponse({ type: NotificationUnreadCountDto })
  unreadCount(
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<NotificationUnreadCountDto> {
    return this.service.unreadCount(request.user)
  }

  @Post(':notificationId/read')
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ type: StudentNotificationDto, strategy: 'excludeAll' })
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'notificationId', format: 'uuid' })
  @ApiOkResponse({ type: StudentNotificationDto })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  markRead(
    @Param('notificationId', new ParseUUIDPipe({ version: '4' }))
    notificationId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<StudentNotificationDto> {
    return this.service.markRead(request.user, notificationId)
  }
}

function notificationValidationException(
  issues: { path: PropertyKey[]; message: string }[],
) {
  return new BadRequestException({
    code: 'NOTIFICATION_INVALID_REQUEST',
    message: 'Invalid notification request',
    issues: issues.map((issue) => ({
      field: issue.path.join('.') || 'query',
      message: issue.message,
    })),
  })
}
