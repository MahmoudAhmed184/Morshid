import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  SerializeOptions,
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import type { z } from 'zod'

import {
  NestBadRequestErrorDto,
  OpenApiErrorDto,
  OpenApiValidationErrorDto,
} from '../../common/http/openapi-error.dto'
import { ApiAccessTokenAuth } from '../../common/http/openapi.decorators'
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe'
import { Roles, UserRole } from '../identity/identity.roles'
import {
  CreateUniversityRequestDto,
  UpdateUniversityRequestDto,
  UpdateUniversityStatusRequestDto,
  UniversityListResponseDto,
  UniversityResponseDto,
  createUniversityRequestSchema,
  listUniversitiesQuerySchema,
  updateUniversityRequestSchema,
  updateUniversityStatusRequestSchema,
  type CreateUniversityRequest,
  type ListUniversitiesQuery,
  type UpdateUniversityRequest,
  type UpdateUniversityStatusRequest,
} from './universities.types'
import {
  invalidUniversitiesRequestException,
  type UniversitiesValidationIssue,
} from './universities.errors'
import { UniversitiesService } from './universities.service'

function mapZodIssue(issue: z.core.$ZodIssue): UniversitiesValidationIssue {
  return {
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }
}

const bodyOrRouteParamBadRequestSchema = {
  schema: {
    oneOf: [
      { $ref: getSchemaPath(OpenApiValidationErrorDto) },
      { $ref: getSchemaPath(NestBadRequestErrorDto) },
    ],
  },
}

@Controller('universities')
@ApiTags('universities')
@Roles(UserRole.SUPER_ADMIN)
@ApiAccessTokenAuth()
@ApiExtraModels(OpenApiValidationErrorDto, NestBadRequestErrorDto)
@UseInterceptors(ClassSerializerInterceptor)
export class UniversitiesController {
  constructor(private readonly universitiesService: UniversitiesService) {}

  @Get()
  @SerializeOptions({
    type: UniversityListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List universities with pagination and filters' })
  @ApiOkResponse({
    type: UniversityListResponseDto,
    description: 'A paginated list of universities.',
  })
  @ApiBadRequestResponse({ type: OpenApiValidationErrorDto })
  @ApiForbiddenResponse({ type: OpenApiErrorDto })
  listUniversities(
    @Query(
      new ZodValidationPipe(listUniversitiesQuerySchema, (issues) =>
        invalidUniversitiesRequestException(issues.map(mapZodIssue)),
      ),
    )
    query: ListUniversitiesQuery,
  ): Promise<UniversityListResponseDto> {
    return this.universitiesService.listUniversities(query)
  }

  @Post()
  @SerializeOptions({
    type: UniversityResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Create university and its primary ADMIN owner' })
  @ApiBody({ type: CreateUniversityRequestDto })
  @ApiCreatedResponse({
    type: UniversityResponseDto,
    description: 'The created university and primary owner.',
  })
  @ApiBadRequestResponse({ type: OpenApiValidationErrorDto })
  @ApiConflictResponse({ type: OpenApiErrorDto })
  @ApiForbiddenResponse({ type: OpenApiErrorDto })
  createUniversity(
    @Body(
      new ZodValidationPipe(createUniversityRequestSchema, (issues) =>
        invalidUniversitiesRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: CreateUniversityRequest,
  ): Promise<UniversityResponseDto> {
    return this.universitiesService.createUniversity(body)
  }

  @Get(':universityId')
  @SerializeOptions({
    type: UniversityResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Get university details' })
  @ApiParam({ name: 'universityId', format: 'uuid' })
  @ApiOkResponse({
    type: UniversityResponseDto,
    description:
      'University details with owner information and aggregate counts.',
  })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiForbiddenResponse({ type: OpenApiErrorDto })
  getUniversity(
    @Param('universityId', new ParseUUIDPipe({ version: '4' }))
    universityId: string,
  ): Promise<UniversityResponseDto> {
    return this.universitiesService.getUniversity(universityId)
  }

  @Patch(':universityId')
  @SerializeOptions({
    type: UniversityResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Update university metadata' })
  @ApiParam({ name: 'universityId', format: 'uuid' })
  @ApiBody({ type: UpdateUniversityRequestDto })
  @ApiOkResponse({
    type: UniversityResponseDto,
    description: 'The updated university.',
  })
  @ApiBadRequestResponse(bodyOrRouteParamBadRequestSchema)
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiConflictResponse({ type: OpenApiErrorDto })
  @ApiForbiddenResponse({ type: OpenApiErrorDto })
  updateUniversity(
    @Param('universityId', new ParseUUIDPipe({ version: '4' }))
    universityId: string,
    @Body(
      new ZodValidationPipe(updateUniversityRequestSchema, (issues) =>
        invalidUniversitiesRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: UpdateUniversityRequest,
  ): Promise<UniversityResponseDto> {
    return this.universitiesService.updateUniversity(universityId, body)
  }

  @Patch(':universityId/status')
  @SerializeOptions({
    type: UniversityResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Update university lifecycle status' })
  @ApiParam({ name: 'universityId', format: 'uuid' })
  @ApiBody({ type: UpdateUniversityStatusRequestDto })
  @ApiOkResponse({
    type: UniversityResponseDto,
    description: 'The university with updated status.',
  })
  @ApiBadRequestResponse(bodyOrRouteParamBadRequestSchema)
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiForbiddenResponse({ type: OpenApiErrorDto })
  updateUniversityStatus(
    @Param('universityId', new ParseUUIDPipe({ version: '4' }))
    universityId: string,
    @Body(
      new ZodValidationPipe(updateUniversityStatusRequestSchema, (issues) =>
        invalidUniversitiesRequestException(issues.map(mapZodIssue)),
      ),
    )
    body: UpdateUniversityStatusRequest,
  ): Promise<UniversityResponseDto> {
    return this.universitiesService.updateUniversityStatus(universityId, body)
  }
}
