import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Headers,
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
  ApiBody,
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger'

import { OpenApiErrorDto } from '../../common/http/openapi-error.dto'
import { getRequestContext } from '../../common/http/request-context'
import { ApiAccessTokenAuth } from '../../common/http/openapi.decorators'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { StudentFlagReason, UserRole } from '../../generated/prisma/client'
import type { AuthenticatedHttpRequest } from '../auth/auth.guard'
import { Roles } from '../auth/roles.decorator'
import { invalidReviewRequestException } from './review-case.errors'
import {
  InstructorReviewActionResponseDto,
  RejectReviewRequestDto,
  rejectReviewRequestSchema,
  type RejectReviewRequest,
  ResolveReviewRequestDto,
  resolveReviewRequestSchema,
  type ResolveReviewRequest,
} from './instructor-review-action.dto'
import { InstructorReviewActionService } from './instructor-review-action.service'
import { InstructorReviewDetailDto } from './instructor-review-detail.dto'
import { InstructorReviewDetailService } from './instructor-review-detail.service'
import {
  InstructorReviewQueueResponseDto,
  instructorReviewQueueQuerySchema,
  type InstructorReviewQueueQuery,
} from './instructor-review-queue.dto'
import { InstructorReviewQueueService } from './instructor-review-queue.service'

@Controller('instructor/reviews')
@ApiTags('instructor-reviews')
@Roles(UserRole.INSTRUCTOR)
@ApiAccessTokenAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class InstructorReviewQueueController {
  constructor(
    private readonly service: InstructorReviewQueueService,
    private readonly detailService: InstructorReviewDetailService,
    private readonly actionService: InstructorReviewActionService,
  ) {}

  @Get()
  @SerializeOptions({
    type: InstructorReviewQueueResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List the Instructor review queue' })
  @ApiOkResponse({
    type: InstructorReviewQueueResponseDto,
    description:
      'Pending-first queue for courses owned by the authenticated Instructor.',
  })
  @ApiBadRequestResponse({ type: OpenApiErrorDto })
  @ApiNotFoundResponse({
    type: OpenApiErrorDto,
    description:
      'The requested course is absent or not owned by the Instructor.',
  })
  @ApiQuery({ name: 'courseId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'cursor', required: false, format: 'uuid' })
  @ApiQuery({
    name: 'studentFlagReason',
    required: false,
    enum: StudentFlagReason,
    enumName: 'StudentFlagReason',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  })
  list(
    @Query(
      new ZodValidationPipe(instructorReviewQueueQuerySchema, (issues) =>
        invalidReviewRequestException(
          issues.map((issue) => ({
            field: issue.path.join('.') || 'query',
            message: issue.message,
          })),
        ),
      ),
    )
    query: InstructorReviewQueueQuery,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<InstructorReviewQueueResponseDto> {
    return this.service.list(request.user, query)
  }

  @Get(':reviewCaseId')
  @SerializeOptions({ type: InstructorReviewDetailDto, strategy: 'excludeAll' })
  @ApiOperation({ summary: 'Get an Instructor review case' })
  @ApiParam({ name: 'reviewCaseId', format: 'uuid' })
  @ApiOkResponse({
    type: InstructorReviewDetailDto,
    description: 'Bounded review evidence for an assigned Instructor.',
  })
  @ApiBadRequestResponse({ type: OpenApiErrorDto })
  @ApiNotFoundResponse({
    type: OpenApiErrorDto,
    description: 'The review is absent, deleted, or inaccessible.',
  })
  get(
    @Param('reviewCaseId', new ParseUUIDPipe({ version: '4' }))
    reviewCaseId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<InstructorReviewDetailDto> {
    return this.detailService.get(request.user, reviewCaseId)
  }

  @Post(':reviewCaseId/resolve')
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({
    type: InstructorReviewActionResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Publish a terminal Instructor review outcome' })
  @ApiParam({ name: 'reviewCaseId', format: 'uuid' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: ResolveReviewRequestDto })
  @ApiOkResponse({ type: InstructorReviewActionResponseDto })
  @ApiBadRequestResponse({ type: OpenApiErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiConflictResponse({ type: OpenApiErrorDto })
  resolve(
    @Param('reviewCaseId', new ParseUUIDPipe({ version: '4' }))
    reviewCaseId: string,
    @Headers('idempotency-key') rawIdempotencyKey: string | undefined,
    @Body(
      new ZodValidationPipe(resolveReviewRequestSchema, reviewValidationError),
    )
    body: ResolveReviewRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<InstructorReviewActionResponseDto> {
    return this.actionService.resolve(
      reviewCaseId,
      body,
      requireIdempotencyKey(rawIdempotencyKey),
      request.user,
      getRequestContext(request),
    )
  }

  @Post(':reviewCaseId/reject')
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({
    type: InstructorReviewActionResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Reject a Student review request' })
  @ApiParam({ name: 'reviewCaseId', format: 'uuid' })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiBody({ type: RejectReviewRequestDto })
  @ApiOkResponse({ type: InstructorReviewActionResponseDto })
  @ApiBadRequestResponse({ type: OpenApiErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiConflictResponse({ type: OpenApiErrorDto })
  reject(
    @Param('reviewCaseId', new ParseUUIDPipe({ version: '4' }))
    reviewCaseId: string,
    @Headers('idempotency-key') rawIdempotencyKey: string | undefined,
    @Body(
      new ZodValidationPipe(rejectReviewRequestSchema, reviewValidationError),
    )
    body: RejectReviewRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<InstructorReviewActionResponseDto> {
    return this.actionService.reject(
      reviewCaseId,
      body,
      requireIdempotencyKey(rawIdempotencyKey),
      request.user,
      getRequestContext(request),
    )
  }
}

function reviewValidationError(
  issues: { path: PropertyKey[]; message: string }[],
) {
  return invalidReviewRequestException(
    issues.map((issue) => ({
      field: issue.path.join('.') || 'body',
      message: issue.message,
    })),
  )
}

function requireIdempotencyKey(rawValue: string | undefined) {
  const value = rawValue?.trim()
  if (value === undefined || value.length === 0 || value.length > 200) {
    throw invalidReviewRequestException([
      {
        field: 'Idempotency-Key',
        message: 'Idempotency-Key must contain 1 to 200 characters',
      },
    ])
  }
  return value
}
