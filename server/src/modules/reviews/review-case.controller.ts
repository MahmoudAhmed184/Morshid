import type { Response } from 'express'
import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  SerializeOptions,
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTooManyRequestsResponse,
  ApiTags,
} from '@nestjs/swagger'

import { getRequestContext } from '../../common/http/request-context'
import { OpenApiErrorDto } from '../../common/http/openapi-error.dto'
import { ApiAccessTokenAuth } from '../../common/http/openapi.decorators'
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe'
import { UserRole } from '../../generated/prisma/client'
import type { AuthenticatedHttpRequest } from '../identity/identity.guard'
import { Roles } from '../identity/identity.roles'
import {
  CreateReviewRequestDto,
  CreateReviewRequestResponseDto,
  createReviewRequestSchema,
  type CreateReviewRequest,
} from './review-case.dto'
import { invalidReviewRequestException } from './review-case.errors'
import { ReviewCaseCreator } from './review-case.creator'
import {
  PublishedReviewContractDto,
  ReviewActionContractDto,
  ReviewDetailContractDto,
  ReviewQueueItemContractDto,
} from './review-contract.dto'

@Controller('messages/:messageId/review-requests')
@ApiTags('student-reviews')
@Roles(UserRole.STUDENT)
@ApiAccessTokenAuth()
@ApiExtraModels(
  ReviewQueueItemContractDto,
  ReviewDetailContractDto,
  ReviewActionContractDto,
  PublishedReviewContractDto,
)
@UseInterceptors(ClassSerializerInterceptor)
export class ReviewCaseController {
  constructor(private readonly creator: ReviewCaseCreator) {}

  @Post()
  @SerializeOptions({
    type: CreateReviewRequestResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({
    summary: 'Request Instructor review of an assistant response',
  })
  @ApiParam({ name: 'messageId', format: 'uuid' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'A caller-generated key of 1–200 characters.',
  })
  @ApiBody({ type: CreateReviewRequestDto })
  @ApiCreatedResponse({ type: CreateReviewRequestResponseDto })
  @ApiOkResponse({
    type: CreateReviewRequestResponseDto,
    description: 'An existing case or exact idempotent replay.',
  })
  @ApiBadRequestResponse({ type: OpenApiErrorDto })
  @ApiNotFoundResponse({
    type: OpenApiErrorDto,
    description: 'The target is absent or inaccessible to the Student.',
  })
  @ApiConflictResponse({ type: OpenApiErrorDto })
  @ApiTooManyRequestsResponse({
    type: OpenApiErrorDto,
    description: 'The Student has created three manual review cases today.',
  })
  @ApiPayloadTooLargeResponse({ type: OpenApiErrorDto })
  async create(
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
    @Headers('idempotency-key') rawIdempotencyKey: string | undefined,
    @Body(
      new ZodValidationPipe(createReviewRequestSchema, (issues) =>
        invalidReviewRequestException(
          issues.map((issue) => ({
            field: issue.path.join('.') || 'body',
            message: issue.message,
          })),
        ),
      ),
    )
    body: CreateReviewRequest,
    @Req() request: AuthenticatedHttpRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CreateReviewRequestResponseDto> {
    const idempotencyKey = rawIdempotencyKey?.trim()
    if (
      idempotencyKey === undefined ||
      idempotencyKey.length === 0 ||
      idempotencyKey.length > 200
    ) {
      throw invalidReviewRequestException([
        {
          field: 'Idempotency-Key',
          message: 'Idempotency-Key must contain 1 to 200 characters',
        },
      ])
    }

    const result = await this.creator.createManual(
      messageId,
      body,
      idempotencyKey,
      request.user,
      getRequestContext(request),
    )
    response.status(result.replayed ? 200 : 201)
    return result
  }
}
