import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  SerializeOptions,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Response } from 'express'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
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
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { getRequestContext } from '../../common/http/request-context'
import { UserRole } from '../../generated/prisma/client'
import type { AuthenticatedHttpRequest } from '../identity/identity.guard'
import type { AppEnvironment } from '../config/env.schema'
import { Roles } from '../identity/identity.roles'
import { TutoringRuntime } from '../tutoring/interface/tutoring-runtime'
import type { TutoringTurnReceipt } from '../tutoring/interface/tutoring-turn-receipt'
import { ConversationCourseBoundaryAuditFilter } from './conversation-course-boundary-audit.filter'
import {
  ChatMessageHistoryResponseDto,
  TutoringTurnResponseDto,
  ChatSessionListResponseDto,
  ChatSessionResponseDto,
  CreateChatSessionRequestDto,
  RenameChatSessionRequestDto,
  SendStudentChatMessageRequestDto,
  createChatSessionRequestSchema,
  listChatMessagesQuerySchema,
  listChatSessionsQuerySchema,
  renameChatSessionRequestSchema,
  sendStudentChatMessageRequestSchema,
  type CreateChatSessionRequest,
  type ListChatMessagesQuery,
  type ListChatSessionsQuery,
  type RenameChatSessionRequest,
  type SendStudentChatMessageRequest,
} from '../conversations/conversations.dto'
import {
  invalidStudentChatRequestException,
  type StudentChatValidationIssue,
} from '../conversations/conversation.errors'
import { ConversationsService } from '../conversations/conversations.service'

const uuidParam = () => new ParseUUIDPipe({ version: '4' })

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

const invalidUuidBadRequest = () =>
  ApiBadRequestResponse({
    type: NestBadRequestErrorDto,
    description: 'A path parameter is not a valid UUID.',
  })

const notFound = () =>
  ApiNotFoundResponse({
    type: OpenApiErrorDto,
    description: 'The chat session was not found.',
  })

const courseIdParam = () => ApiParam({ name: 'courseId', format: 'uuid' })
const sessionIdParam = () => ApiParam({ name: 'sessionId', format: 'uuid' })
const studentMessageIdParam = () =>
  ApiParam({ name: 'studentMessageId', format: 'uuid' })

const tutoringTurnConflict = () =>
  ApiConflictResponse({
    type: OpenApiErrorDto,
    description:
      'Another turn is in progress, or the selected response cannot be retried.',
  })

const tutoringTurnUnavailable = () =>
  ApiServiceUnavailableResponse({
    type: OpenApiErrorDto,
    description: 'A trustworthy terminal chat state could not be persisted.',
  })

@Controller('courses/:courseId/chat-sessions')
@ApiTags('student-chat-sessions')
@Roles(UserRole.STUDENT)
@ApiAccessTokenAuth()
@ApiExtraModels(OpenApiValidationErrorDto, NestBadRequestErrorDto)
@UseFilters(ConversationCourseBoundaryAuditFilter)
@UseInterceptors(ClassSerializerInterceptor)
export class ConversationsController {
  constructor(
    private readonly studentChatService: ConversationsService,
    private readonly tutoringRuntime: TutoringRuntime,
    private readonly configService: ConfigService<AppEnvironment, true>,
  ) {}

  @Post()
  @SerializeOptions({
    type: ChatSessionResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Create chat session' })
  @courseIdParam()
  @ApiBody({ type: CreateChatSessionRequestDto })
  @ApiCreatedResponse({ type: ChatSessionResponseDto })
  @invalidRequestOrUuidBadRequest()
  createSession(
    @Param('courseId', uuidParam()) courseId: string,
    @Body(
      new ZodValidationPipe(createChatSessionRequestSchema, (issues) =>
        invalidStudentChatRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: CreateChatSessionRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<ChatSessionResponseDto> {
    return this.studentChatService.createSession(
      courseId,
      body,
      request.user,
      getRequestContext(request),
    )
  }

  @Get()
  @SerializeOptions({
    type: ChatSessionListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List chat sessions' })
  @courseIdParam()
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String, format: 'uuid' })
  @ApiOkResponse({ type: ChatSessionListResponseDto })
  @invalidRequestOrUuidBadRequest()
  listSessions(
    @Param('courseId', uuidParam()) courseId: string,
    @Query(
      new ZodValidationPipe(listChatSessionsQuerySchema, (issues) =>
        invalidStudentChatRequestException(issues.map(mapZodIssue)),
      ),
    )
    query: ListChatSessionsQuery,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<ChatSessionListResponseDto> {
    return this.studentChatService.listSessions(
      courseId,
      request.user,
      query,
      getRequestContext(request),
    )
  }

  @Get(':sessionId')
  @SerializeOptions({
    type: ChatSessionResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Get chat session' })
  @courseIdParam()
  @sessionIdParam()
  @ApiOkResponse({ type: ChatSessionResponseDto })
  @invalidUuidBadRequest()
  @notFound()
  getSession(
    @Param('courseId', uuidParam()) courseId: string,
    @Param('sessionId', uuidParam()) sessionId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<ChatSessionResponseDto> {
    return this.studentChatService.getSession(
      courseId,
      sessionId,
      request.user,
      getRequestContext(request),
    )
  }

  @Patch(':sessionId')
  @SerializeOptions({
    type: ChatSessionResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Rename chat session' })
  @courseIdParam()
  @sessionIdParam()
  @ApiBody({ type: RenameChatSessionRequestDto })
  @ApiOkResponse({ type: ChatSessionResponseDto })
  @invalidRequestOrUuidBadRequest()
  @notFound()
  renameSession(
    @Param('courseId', uuidParam()) courseId: string,
    @Param('sessionId', uuidParam()) sessionId: string,
    @Body(
      new ZodValidationPipe(renameChatSessionRequestSchema, (issues) =>
        invalidStudentChatRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: RenameChatSessionRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<ChatSessionResponseDto> {
    return this.studentChatService.renameSession(
      courseId,
      sessionId,
      body,
      request.user,
      getRequestContext(request),
    )
  }

  @Delete(':sessionId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete chat session' })
  @courseIdParam()
  @sessionIdParam()
  @ApiNoContentResponse()
  @invalidUuidBadRequest()
  @notFound()
  async softDeleteSession(
    @Param('courseId', uuidParam()) courseId: string,
    @Param('sessionId', uuidParam()) sessionId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<void> {
    await this.studentChatService.softDeleteSession(
      courseId,
      sessionId,
      request.user,
      getRequestContext(request),
    )
  }

  @Get(':sessionId/messages')
  @SerializeOptions({
    type: ChatMessageHistoryResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List chat session messages' })
  @courseIdParam()
  @sessionIdParam()
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'after', required: false, type: Number })
  @ApiQuery({ name: 'before', required: false, type: Number })
  @ApiQuery({
    name: 'page',
    required: false,
    enum: ['latest'],
    description:
      'Use page=latest to load the newest page. It cannot be combined with cursor parameters.',
  })
  @ApiOkResponse({ type: ChatMessageHistoryResponseDto })
  @invalidRequestOrUuidBadRequest()
  @notFound()
  listMessages(
    @Param('courseId', uuidParam()) courseId: string,
    @Param('sessionId', uuidParam()) sessionId: string,
    @Query(
      new ZodValidationPipe(listChatMessagesQuerySchema, (issues) =>
        invalidStudentChatRequestException(issues.map(mapZodIssue)),
      ),
    )
    query: ListChatMessagesQuery,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<ChatMessageHistoryResponseDto> {
    return this.studentChatService.listMessages(
      courseId,
      sessionId,
      request.user,
      query,
      getRequestContext(request),
    )
  }

  @Post(':sessionId/messages')
  @SerializeOptions({
    type: TutoringTurnResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Send tutoring message' })
  @courseIdParam()
  @sessionIdParam()
  @ApiBody({ type: SendStudentChatMessageRequestDto })
  @ApiCreatedResponse({ type: TutoringTurnResponseDto })
  @invalidRequestOrUuidBadRequest()
  @notFound()
  @tutoringTurnConflict()
  @tutoringTurnUnavailable()
  sendMessage(
    @Param('courseId', uuidParam()) courseId: string,
    @Param('sessionId', uuidParam()) sessionId: string,
    @Body(
      new ZodValidationPipe(sendStudentChatMessageRequestSchema, (issues) =>
        invalidStudentChatRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: SendStudentChatMessageRequest,
    @Req() request: AuthenticatedHttpRequest,
    @Res({ passthrough: true }) response?: Response,
  ): Promise<TutoringTurnReceipt> {
    const budget = createRequestBudget(
      this.configService.get('TUTORING_REQUEST_TIMEOUT_MS', {
        infer: true,
      }),
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
      throw invalidStudentChatRequestException([
        { field: 'body', message: 'Retry requests must not include a body' },
      ])
    }

    const budget = createRequestBudget(
      this.configService.get('TUTORING_REQUEST_TIMEOUT_MS', {
        infer: true,
      }),
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
}): StudentChatValidationIssue {
  return {
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }
}
