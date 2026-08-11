import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  SerializeOptions,
  UseFilters,
  UseInterceptors,
  Inject,
} from '@nestjs/common'
import type { Response } from 'express'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'

import {
  NestBadRequestErrorDto,
  OpenApiErrorDto,
  OpenApiValidationErrorDto,
} from '../../common/http/openapi-error.dto'
import { ApiAccessTokenAuth } from '../../common/http/openapi.decorators'
import { createRequestBudget } from '../../common/http/request-deadline'
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe'
import { getRequestContext } from '../../common/http/request-context'
import type { AuthenticatedHttpRequest } from '../identity/identity.guard'
import { Roles, UserRole } from '../identity/identity.roles'
import { TutoringRuntime } from './interface/tutoring-runtime'
import type { TutoringTurnReceipt } from './interface/tutoring-turn-receipt'
import {
  TUTORING_CONFIGURATION,
  type TutoringConfiguration,
} from './tutoring.configuration'
import { ConversationCourseBoundaryAuditFilter } from '../conversations/interface/conversation-course-boundary-audit.filter'
import {
  TutoringTurnResponseDto,
  SendTutoringMessageRequestDto,
  sendTutoringMessageRequestSchema,
  type SendTutoringMessageRequest,
} from '../conversations/conversations.dto'
import {
  invalidConversationRequestException,
  type ConversationValidationIssue,
} from '../conversations/conversation.errors'

const uuidParam = () => new ParseUUIDPipe({ version: '4' })
const courseIdParam = () => ApiParam({ name: 'courseId', format: 'uuid' })
const sessionIdParam = () => ApiParam({ name: 'sessionId', format: 'uuid' })
const studentMessageIdParam = () =>
  ApiParam({ name: 'studentMessageId', format: 'uuid' })

const invalidRequestOrUuidBadRequest = () =>
  ApiBadRequestResponse({
    description:
      'The request body/query failed validation, or a path parameter is not a valid UUID.',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(OpenApiValidationErrorDto) },
        { $ref: getSchemaPath(NestBadRequestErrorDto) },
      ],
    },
  })

const notFound = () =>
  ApiNotFoundResponse({
    type: OpenApiErrorDto,
    description: 'The tutoring session was not found.',
  })

const tutoringTurnConflict = () =>
  ApiConflictResponse({
    type: OpenApiErrorDto,
    description:
      'Another turn is in progress, or the selected response cannot be retried.',
  })

const tutoringTurnUnavailable = () =>
  ApiServiceUnavailableResponse({
    type: OpenApiErrorDto,
    description:
      'A trustworthy terminal tutoring state could not be persisted.',
  })

@Controller('courses/:courseId/chat-sessions')
@ApiTags('tutoring')
@Roles(UserRole.STUDENT)
@ApiAccessTokenAuth()
@ApiExtraModels(OpenApiValidationErrorDto, NestBadRequestErrorDto)
@UseFilters(ConversationCourseBoundaryAuditFilter)
@UseInterceptors(ClassSerializerInterceptor)
export class TutoringController {
  constructor(
    private readonly tutoringRuntime: TutoringRuntime,
    @Inject(TUTORING_CONFIGURATION)
    private readonly tutoringConfiguration: TutoringConfiguration,
  ) {}

  @Post(':sessionId/messages')
  @SerializeOptions({
    type: TutoringTurnResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Send tutoring message' })
  @courseIdParam()
  @sessionIdParam()
  @ApiBody({ type: SendTutoringMessageRequestDto })
  @ApiCreatedResponse({ type: TutoringTurnResponseDto })
  @invalidRequestOrUuidBadRequest()
  @notFound()
  @tutoringTurnConflict()
  @tutoringTurnUnavailable()
  sendMessage(
    @Param('courseId', uuidParam()) courseId: string,
    @Param('sessionId', uuidParam()) sessionId: string,
    @Body(
      new ZodValidationPipe(sendTutoringMessageRequestSchema, (issues) =>
        invalidConversationRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: SendTutoringMessageRequest,
    @Req() request: AuthenticatedHttpRequest,
    @Res({ passthrough: true }) response?: Response,
  ): Promise<TutoringTurnReceipt> {
    const budget = createRequestBudget(
      this.tutoringConfiguration.TUTORING_REQUEST_TIMEOUT_MS,
      { request, response },
    )

    return this.tutoringRuntime
      .run({
        kind: 'new',
        courseId,
        sessionId,
        studentId: request.user.id,
        content: body.content,
        ...(body.clientMessageId === undefined
          ? {}
          : { clientMessageId: body.clientMessageId }),
        ...(body.problemId === undefined ? {} : { problemId: body.problemId }),
        ...(body.conceptId === undefined ? {} : { conceptId: body.conceptId }),
        ...(body.title === undefined ? {} : { title: body.title }),
        requestContext: getRequestContext(request),
        requestBudget: budget,
      })
      .finally(() => {
        budget.dispose()
      })
  }

  @Post(':sessionId/messages/:studentMessageId/retry')
  @HttpCode(200)
  @SerializeOptions({
    type: TutoringTurnResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Retry failed tutoring response' })
  @courseIdParam()
  @sessionIdParam()
  @studentMessageIdParam()
  @ApiOkResponse({ type: TutoringTurnResponseDto })
  @invalidRequestOrUuidBadRequest()
  @notFound()
  @tutoringTurnConflict()
  @tutoringTurnUnavailable()
  retryMessage(
    @Param('courseId', uuidParam()) courseId: string,
    @Param('sessionId', uuidParam()) sessionId: string,
    @Param('studentMessageId', uuidParam()) studentMessageId: string,
    @Req() request: AuthenticatedHttpRequest,
    @Res({ passthrough: true }) response?: Response,
  ): Promise<TutoringTurnReceipt> {
    if (request.body !== undefined) {
      throw invalidConversationRequestException([
        { field: 'body', message: 'Retry requests must not include a body' },
      ])
    }

    const budget = createRequestBudget(
      this.tutoringConfiguration.TUTORING_REQUEST_TIMEOUT_MS,
      { request, response },
    )

    return this.tutoringRuntime
      .run({
        kind: 'retry',
        courseId,
        sessionId,
        studentId: request.user.id,
        studentMessageId,
        requestContext: getRequestContext(request),
        requestBudget: budget,
      })
      .finally(() => {
        budget.dispose()
      })
  }
}

function mapZodIssue(issue: {
  path: PropertyKey[]
  message: string
}): ConversationValidationIssue {
  return {
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }
}
