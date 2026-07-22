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
  SerializeOptions,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common'
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
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { getRequestContext } from '../../common/http/request-context'
import { UserRole } from '../../generated/prisma/client'
import type { AuthenticatedHttpRequest } from '../auth/auth.guard'
import { Roles } from '../auth/roles.decorator'
import { StudentChatCourseBoundaryAuditFilter } from './student-chat-course-boundary-audit.filter'
import {
  ChatMessageHistoryResponseDto,
  GroundedChatTurnResponseDto,
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
} from './student-chat.dto'
import {
  invalidStudentChatRequestException,
  type StudentChatValidationIssue,
} from './student-chat.errors'
import { StudentChatService } from './student-chat.service'
import { GroundedChatService } from './grounded-chat.service'

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

const groundedChatConflict = () =>
  ApiConflictResponse({
    type: OpenApiErrorDto,
    description:
      'Another turn is in progress, or the selected response cannot be retried.',
  })

const groundedChatUnavailable = () =>
  ApiServiceUnavailableResponse({
    type: OpenApiErrorDto,
    description: 'A trustworthy terminal chat state could not be persisted.',
  })

@Controller('courses/:courseId/chat-sessions')
@ApiTags('student-chat-sessions')
@Roles(UserRole.STUDENT)
@ApiAccessTokenAuth()
@ApiExtraModels(OpenApiValidationErrorDto, NestBadRequestErrorDto)
@UseFilters(StudentChatCourseBoundaryAuditFilter)
@UseInterceptors(ClassSerializerInterceptor)
export class StudentChatController {
  constructor(
    private readonly studentChatService: StudentChatService,
    private readonly groundedChatService: GroundedChatService,
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
    type: GroundedChatTurnResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Send grounded chat message' })
  @courseIdParam()
  @sessionIdParam()
  @ApiBody({ type: SendStudentChatMessageRequestDto })
  @ApiCreatedResponse({ type: GroundedChatTurnResponseDto })
  @invalidRequestOrUuidBadRequest()
  @notFound()
  @groundedChatConflict()
  @groundedChatUnavailable()
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
  ): Promise<GroundedChatTurnResponseDto> {
    return this.groundedChatService.send(
      courseId,
      sessionId,
      body,
      request.user,
      getRequestContext(request),
    )
  }

  @Post(':sessionId/messages/:studentMessageId/retry')
  @HttpCode(200)
  @SerializeOptions({
    type: GroundedChatTurnResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Retry failed grounded chat response' })
  @courseIdParam()
  @sessionIdParam()
  @studentMessageIdParam()
  @ApiOkResponse({ type: GroundedChatTurnResponseDto })
  @invalidRequestOrUuidBadRequest()
  @notFound()
  @groundedChatConflict()
  @groundedChatUnavailable()
  retryMessage(
    @Param('courseId', uuidParam()) courseId: string,
    @Param('sessionId', uuidParam()) sessionId: string,
    @Param('studentMessageId', uuidParam()) studentMessageId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<GroundedChatTurnResponseDto> {
    if (request.body !== undefined) {
      throw invalidStudentChatRequestException([
        { field: 'body', message: 'Retry requests must not include a body' },
      ])
    }

    return this.groundedChatService.retry(
      courseId,
      sessionId,
      studentMessageId,
      request.user,
      getRequestContext(request),
    )
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
