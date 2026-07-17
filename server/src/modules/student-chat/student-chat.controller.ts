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
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { getRequestContext } from '../../common/http/request-context'
import { UserRole } from '../../generated/prisma/client'
import type { AuthenticatedHttpRequest } from '../auth/auth.guard'
import { Roles } from '../auth/roles.decorator'
import { StudentChatRoleDenialAuditFilter } from './student-chat-role-denial-audit.filter'
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
} from './student-chat.dto'
import {
  invalidStudentChatRequestException,
  type StudentChatValidationIssue,
} from './student-chat.errors'
import { StudentChatService } from './student-chat.service'

const uuidParam = () => new ParseUUIDPipe({ version: '4' })

@Controller('courses/:courseId/chat-sessions')
@ApiTags('student-chat-sessions')
@Roles(UserRole.STUDENT)
@ApiBearerAuth()
@UseFilters(StudentChatRoleDenialAuditFilter)
@UseInterceptors(ClassSerializerInterceptor)
@ApiUnauthorizedResponse({ description: 'Authentication is required.' })
@ApiForbiddenResponse({
  description: 'An active Student membership in the course is required.',
})
@ApiNotFoundResponse({ description: 'Chat session was not found.' })
@ApiBadRequestResponse({ description: 'Invalid request body.' })
export class StudentChatController {
  constructor(private readonly studentChatService: StudentChatService) {}

  @Post()
  @SerializeOptions({
    type: ChatSessionResponseDto,
    strategy: 'excludeAll',
  })
  @ApiBody({ type: CreateChatSessionRequestDto })
  @ApiCreatedResponse({ type: ChatSessionResponseDto })
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
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cursor', required: false, type: String, format: 'uuid' })
  @ApiOkResponse({ type: ChatSessionListResponseDto })
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
  @ApiOkResponse({ type: ChatSessionResponseDto })
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
  @ApiBody({ type: RenameChatSessionRequestDto })
  @ApiOkResponse({ type: ChatSessionResponseDto })
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
  @ApiNoContentResponse()
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
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'after', required: false, type: Number })
  @ApiOkResponse({ type: ChatMessageHistoryResponseDto })
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
