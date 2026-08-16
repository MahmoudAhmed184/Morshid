import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  HttpCode,
  Patch,
  Req,
  SerializeOptions,
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'

import {
  NestBadRequestErrorDto,
  OpenApiValidationErrorDto,
} from '../../../common/http/openapi-error.dto'
import { ApiAccessTokenAuth } from '../../../common/http/openapi.decorators'
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe'
import type { AuthenticatedHttpRequest } from '../../identity/identity.guard'
import { Roles, UserRole } from '../../identity/identity.roles'
import {
  StudentTutoringPreferencesDto,
  UpdateStudentTutoringPreferencesRequestDto,
  updateStudentTutoringPreferencesSchema,
  type UpdateStudentTutoringPreferencesRequest,
} from './student-tutoring-preferences.dto'
import { StudentTutoringPreferencesService } from './student-tutoring-preferences.service'

const invalidRequestBadRequest = () =>
  ApiBadRequestResponse({
    description: 'The request body failed validation.',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(OpenApiValidationErrorDto) },
        { $ref: getSchemaPath(NestBadRequestErrorDto) },
      ],
    },
  })

function invalidPreferencesRequestException(
  issues: readonly { path: string; message: string; code: string }[],
): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: 'Invalid student tutoring preferences request',
    errors: issues,
  })
}

function mapZodIssue(issue: {
  path: PropertyKey[]
  message: string
  code?: string
}) {
  return {
    path: issue.path.map(String).join('.'),
    message: issue.message,
    code: issue.code ?? 'custom',
  }
}

@Controller('student/tutoring-preferences')
@ApiTags('tutoring')
@Roles(UserRole.STUDENT)
@ApiAccessTokenAuth()
@ApiExtraModels(OpenApiValidationErrorDto, NestBadRequestErrorDto)
@UseInterceptors(ClassSerializerInterceptor)
export class StudentTutoringPreferencesController {
  constructor(
    private readonly preferencesService: StudentTutoringPreferencesService,
  ) {}

  @Get()
  @SerializeOptions({
    type: StudentTutoringPreferencesDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Get student tutoring preferences' })
  @ApiOkResponse({
    type: StudentTutoringPreferencesDto,
    description: 'The student tutoring preferences.',
  })
  getPreferences(
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<StudentTutoringPreferencesDto> {
    return this.preferencesService.getPreferences(request.user.id)
  }

  @Patch()
  @HttpCode(200)
  @SerializeOptions({
    type: StudentTutoringPreferencesDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Update student tutoring preferences' })
  @ApiBody({ type: UpdateStudentTutoringPreferencesRequestDto })
  @ApiOkResponse({
    type: StudentTutoringPreferencesDto,
    description: 'The updated student tutoring preferences.',
  })
  @invalidRequestBadRequest()
  updatePreferences(
    @Body(
      new ZodValidationPipe(updateStudentTutoringPreferencesSchema, (issues) =>
        invalidPreferencesRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: UpdateStudentTutoringPreferencesRequest,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<StudentTutoringPreferencesDto> {
    return this.preferencesService.updatePreferences(request.user.id, body)
  }
}
