import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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

import { OpenApiErrorDto } from '../../../common/http/openapi-error.dto'
import { ApiAccessTokenAuth } from '../../../common/http/openapi.decorators'
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe'
import type { AuthenticatedHttpRequest } from '../../identity/identity.guard'
import { Roles, UserRole } from '../../identity/identity.roles'
import { StudentFlagReason } from '../interface/review-values'
import { invalidReviewRequestException } from '../review-case.errors'
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
}
