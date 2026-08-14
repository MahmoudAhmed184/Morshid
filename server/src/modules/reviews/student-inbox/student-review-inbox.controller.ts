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

import { ApiAccessTokenAuth } from '../../../common/http/openapi.decorators'
import {
  NestBadRequestErrorDto,
  OpenApiErrorDto,
  OpenApiIssuesErrorDto,
} from '../../../common/http/openapi-error.dto'
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe'
import type { AuthenticatedHttpRequest } from '../../identity/identity.guard'
import { Roles, UserRole } from '../../identity/identity.roles'
import {
  StudentReviewInboxItemDto,
  StudentReviewInboxListResponseDto,
  studentReviewInboxListQuerySchema,
  type StudentReviewInboxListQuery,
  StudentReviewInboxUnreadCountDto,
} from './student-review-inbox.dto'
import { StudentReviewInboxService } from './student-review-inbox.service'

@Controller('reviews/inbox')
@ApiTags('student-reviews')
@Roles(UserRole.STUDENT)
@ApiAccessTokenAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class StudentReviewInboxController {
  constructor(private readonly service: StudentReviewInboxService) {}

  @Get()
  @SerializeOptions({
    type: StudentReviewInboxListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List the Student Review Inbox' })
  @ApiQuery({ name: 'cursor', required: false, format: 'uuid' })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  })
  @ApiOkResponse({ type: StudentReviewInboxListResponseDto })
  @ApiBadRequestResponse({ type: OpenApiIssuesErrorDto })
  list(
    @Query(
      new ZodValidationPipe(
        studentReviewInboxListQuerySchema,
        studentReviewInboxValidationException,
      ),
    )
    query: StudentReviewInboxListQuery,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<StudentReviewInboxListResponseDto> {
    return this.service.list(request.user, query)
  }

  @Get('unread-count')
  @SerializeOptions({
    type: StudentReviewInboxUnreadCountDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Count unread Student Review Inbox items' })
  @ApiOkResponse({ type: StudentReviewInboxUnreadCountDto })
  unreadCount(
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<StudentReviewInboxUnreadCountDto> {
    return this.service.unreadCount(request.user)
  }

  @Post(':inboxItemId/read')
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({
    type: StudentReviewInboxItemDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Mark a Student Review Inbox item as read' })
  @ApiParam({ name: 'inboxItemId', format: 'uuid' })
  @ApiOkResponse({ type: StudentReviewInboxItemDto })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  markRead(
    @Param('inboxItemId', new ParseUUIDPipe({ version: '4' }))
    inboxItemId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<StudentReviewInboxItemDto> {
    return this.service.markRead(request.user, inboxItemId)
  }
}

function studentReviewInboxValidationException(
  issues: { path: PropertyKey[]; message: string }[],
) {
  return new BadRequestException({
    code: 'REVIEW_INBOX_INVALID_REQUEST',
    message: 'Invalid Student Review Inbox request',
    issues: issues.map((issue) => ({
      field: issue.path.join('.') || 'query',
      message: issue.message,
    })),
  })
}
