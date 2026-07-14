import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Post,
  Req,
  SerializeOptions,
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { getRequestContext } from '../../common/http/request-context'
import { UserRole } from '../../generated/prisma/client'
import type { AuthenticatedHttpRequest } from '../auth/auth.guard'
import { Roles } from '../auth/roles.decorator'
import {
  ChatSessionListResponseDto,
  ChatSessionResponseDto,
  CreateChatSessionRequestDto,
  createChatSessionRequestSchema,
  type CreateChatSessionRequest,
} from './student-chat.dto'
import {
  invalidStudentChatRequestException,
  type StudentChatValidationIssue,
} from './student-chat.errors'
import { StudentChatService } from './student-chat.service'

@Controller('courses/:courseId/chat-sessions')
@ApiTags('student-chat-sessions')
@Roles(UserRole.STUDENT)
@ApiBearerAuth()
@UseInterceptors(ClassSerializerInterceptor)
@ApiUnauthorizedResponse({ description: 'Authentication is required.' })
@ApiForbiddenResponse({
  description: 'An active Student membership in the course is required.',
})
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
    @Param('courseId') courseId: string,
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
  @ApiOkResponse({ type: ChatSessionListResponseDto })
  listSessions(
    @Param('courseId') courseId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<ChatSessionListResponseDto> {
    return this.studentChatService.listSessions(
      courseId,
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
