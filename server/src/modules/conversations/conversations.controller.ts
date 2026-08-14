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
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'

import {
  NestBadRequestErrorDto,
  OpenApiErrorDto,
  OpenApiValidationErrorDto,
} from '../../common/http/openapi-error.dto'
import { ApiAccessTokenAuth } from '../../common/http/openapi.decorators'
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe'
import { getRequestContext } from '../../common/http/request-context'
import type { AuthenticatedHttpRequest } from '../identity/identity.guard'
import { Roles, UserRole } from '../identity/identity.roles'
import {
  ChatMessageHistoryResponseDto,
  ChatSessionListResponseDto,
  ChatSessionResponseDto,
  CreateChatSessionRequestDto,
  RenameChatSessionRequestDto,
  createChatSessionRequestSchema,
  listChatMessagesQuerySchema,
  listChatSessionsQuerySchema,
  renameChatSessionRequestSchema,
  type CreateChatSessionRequest,
  type ListChatMessagesQuery,
  type ListChatSessionsQuery,
  type RenameChatSessionRequest,
} from '../conversations/interface/conversation-dto'
import {
  invalidConversationRequestException,
  type ConversationValidationIssue,
} from '../conversations/interface/conversation-errors'
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
@Controller('courses/:courseId/chat-sessions')
@ApiTags('conversations')
@Roles(UserRole.STUDENT)
@ApiAccessTokenAuth()
@ApiExtraModels(OpenApiValidationErrorDto, NestBadRequestErrorDto)
@UseInterceptors(ClassSerializerInterceptor)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

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
        invalidConversationRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: CreateChatSessionRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<ChatSessionResponseDto> {
    return this.conversationsService.createSession(
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
        invalidConversationRequestException(issues.map(mapZodIssue)),
      ),
    )
    query: ListChatSessionsQuery,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<ChatSessionListResponseDto> {
    return this.conversationsService.listSessions(
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
    return this.conversationsService.getSession(
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
        invalidConversationRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: RenameChatSessionRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<ChatSessionResponseDto> {
    return this.conversationsService.renameSession(
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
    await this.conversationsService.softDeleteSession(
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
        invalidConversationRequestException(issues.map(mapZodIssue)),
      ),
    )
    query: ListChatMessagesQuery,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<ChatMessageHistoryResponseDto> {
    return this.conversationsService.listMessages(
      courseId,
      sessionId,
      request.user,
      query,
      getRequestContext(request),
    )
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
