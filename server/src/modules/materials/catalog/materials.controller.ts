import {
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  SerializeOptions,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'

import {
  NestBadRequestErrorDto,
  OpenApiErrorDto,
  OpenApiValidationErrorDto,
} from '../../../common/http/openapi-error.dto'
import { ApiAccessTokenAuth } from '../../../common/http/openapi.decorators'
import { getRequestContext } from '../../../common/http/request-context'
import { ZodValidationPipe } from '../../../common/http/zod-validation.pipe'
import {
  AUDIT_EVENT_ACTIONS,
  AUDIT_TARGET_TYPES,
} from '../../audit/audit.public'
import { AuditRoleDenial } from '../../audit/audit.public'
import type { AuthenticatedHttpRequest } from '../../identity/identity.guard'
import { Roles, UserRole } from '../../identity/identity.roles'
import {
  MaterialListResponseDto,
  MaterialResponseDto,
  MaterialStatusDto,
  UploadMaterialRequestDto,
  type UploadMaterialRequest,
  listMaterialsQuerySchema,
  type ListMaterialsQuery,
} from './materials.dto'
import { MaterialsService } from './materials.service'
import { invalidMaterialsRequestException } from './materials.errors'
import { PdfUploadInterceptor } from '../upload/pdf-upload.interceptor'
import type { UploadedPdfFile } from '../upload/pdf-upload.validator'

@Controller('courses/:courseId/materials')
@ApiTags('materials')
@Roles(UserRole.INSTRUCTOR)
@ApiAccessTokenAuth()
@ApiExtraModels(OpenApiValidationErrorDto, NestBadRequestErrorDto)
@UseInterceptors(ClassSerializerInterceptor)
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post()
  @AuditRoleDenial({
    action: AUDIT_EVENT_ACTIONS.MATERIAL_UPLOAD_DENIED,
    targetType: AUDIT_TARGET_TYPES.MATERIAL,
    reason: 'INSUFFICIENT_ROLE',
  })
  @UseInterceptors(PdfUploadInterceptor)
  @SerializeOptions({
    type: MaterialResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Upload course PDF material' })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiBody({ type: UploadMaterialRequestDto })
  @ApiCreatedResponse({
    type: MaterialResponseDto,
    description: 'The uploaded course material, queued for processing.',
  })
  @ApiBadRequestResponse({
    description: 'The title, PDF metadata, signature, or UUID was invalid.',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(OpenApiValidationErrorDto) },
        { $ref: getSchemaPath(NestBadRequestErrorDto) },
      ],
    },
  })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiPayloadTooLargeResponse({ type: OpenApiErrorDto })
  uploadMaterial(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @UploadedFile() file: UploadedPdfFile | undefined,
    @Req()
    request: AuthenticatedHttpRequest & {
      body: UploadMaterialRequest
    },
  ): Promise<MaterialResponseDto> {
    const body = request.body as UploadMaterialRequest

    return this.materialsService.uploadMaterial(
      courseId,
      {
        title: body.title,
        file,
      },
      request.user,
      getRequestContext(request),
    )
  }

  @Get()
  @SerializeOptions({
    type: MaterialListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List course materials' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiOkResponse({
    type: MaterialListResponseDto,
    description: 'Non-deleted materials for the selected course.',
  })
  @ApiBadRequestResponse({
    type: NestBadRequestErrorDto,
    description: 'The course ID or query was not valid.',
  })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  listMaterials(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Req() request: AuthenticatedHttpRequest,
    @Query(
      new ZodValidationPipe(listMaterialsQuerySchema, (issues) =>
        invalidMaterialsRequestException(
          issues.map((issue) => ({
            field: issue.path.join('.') || 'query',
            message: issue.message,
          })),
        ),
      ),
    )
    query: ListMaterialsQuery,
  ): Promise<MaterialListResponseDto> {
    return this.materialsService.listMaterials(courseId, request.user, query)
  }

  @Get(':materialId/status')
  @SerializeOptions({
    type: MaterialStatusDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Get course material processing status' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiParam({ name: 'materialId', format: 'uuid' })
  @ApiOkResponse({
    type: MaterialStatusDto,
    description: 'The selected material processing status.',
  })
  @ApiBadRequestResponse({
    type: NestBadRequestErrorDto,
    description: 'A path parameter was not a valid UUID.',
  })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  getMaterialStatus(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Param('materialId', new ParseUUIDPipe({ version: '4' }))
    materialId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<MaterialStatusDto> {
    return this.materialsService.getMaterialStatus(
      courseId,
      materialId,
      request.user,
    )
  }

  @Get(':materialId')
  @SerializeOptions({
    type: MaterialResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'Get course material' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiParam({ name: 'materialId', format: 'uuid' })
  @ApiOkResponse({
    type: MaterialResponseDto,
    description: 'The selected course material.',
  })
  @ApiBadRequestResponse({
    type: NestBadRequestErrorDto,
    description: 'A path parameter was not a valid UUID.',
  })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  getMaterial(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Param('materialId', new ParseUUIDPipe({ version: '4' }))
    materialId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<MaterialResponseDto> {
    return this.materialsService.getMaterial(courseId, materialId, request.user)
  }

  @Delete(':materialId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a course material knowledge source' })
  @ApiParam({ name: 'courseId', format: 'uuid' })
  @ApiParam({ name: 'materialId', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Material deleted.' })
  @ApiBadRequestResponse({ type: NestBadRequestErrorDto })
  @ApiForbiddenResponse({ type: OpenApiErrorDto })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  @ApiServiceUnavailableResponse({ type: OpenApiErrorDto })
  async deleteMaterial(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Param('materialId', new ParseUUIDPipe({ version: '4' }))
    materialId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<void> {
    await this.materialsService.deleteMaterial(
      courseId,
      materialId,
      request.user,
      getRequestContext(request),
    )
  }
}
