import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
  ApiTags,
} from '@nestjs/swagger'

import { OpenApiErrorDto } from '../../../common/http/openapi-error.dto'
import { getRequestContext } from '../../../common/http/request-context'
import { ApiAccessTokenAuth } from '../../../common/http/openapi.decorators'
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe'
import type { AuthenticatedHttpRequest } from '../../identity/identity.guard'
import { Roles, UserRole } from '../../identity/identity.roles'
import { invalidReviewRequestException } from '../review-case.errors'
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

@Controller('instructor/reviews')
@ApiTags('instructor-reviews')
@Roles(UserRole.INSTRUCTOR)
@ApiAccessTokenAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class InstructorReviewResolutionController {
  constructor(private readonly actionService: InstructorReviewActionService) {}

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
