import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
} from '@nestjs/swagger'

import {
  OpenApiErrorDto,
  OpenApiValidationErrorDto,
} from '../../common/http/openapi-error.dto'
import { ApiAccessTokenAuth } from '../../common/http/openapi.decorators'
import { getRequestContext } from '../../common/http/request-context'
import { UserRole } from '../../generated/prisma/client'
import type { AuthenticatedHttpRequest } from '../auth/auth.guard'
import { Roles } from '../auth/roles.decorator'
import {
  MaterialListResponseDto,
  MaterialResponseDto,
  UploadMaterialRequestDto,
  type UploadMaterialRequest,
} from './materials.dto'
import { MaterialsService } from './materials.service'
import { PdfUploadInterceptor } from './pdf-upload.interceptor'
import type { UploadedPdfFile } from './pdf-upload.validator'

@Controller('courses/:courseId/materials')
@ApiTags('materials')
@Roles(UserRole.ADMIN, UserRole.INSTRUCTOR)
@ApiAccessTokenAuth()
@UseInterceptors(ClassSerializerInterceptor)
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Post()
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
    type: OpenApiValidationErrorDto,
    description: 'The title, PDF metadata, signature, or UUID was invalid.',
  })
  @ApiPayloadTooLargeResponse({ type: OpenApiErrorDto })
  uploadMaterial(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @UploadedFile() file: UploadedPdfFile | undefined,
    @Req() request: AuthenticatedHttpRequest & {
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
    type: OpenApiValidationErrorDto,
    description: 'The course ID was not a valid UUID.',
  })
  listMaterials(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<MaterialListResponseDto> {
    return this.materialsService.listMaterials(courseId, request.user)
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
    type: OpenApiValidationErrorDto,
    description: 'A path parameter was not a valid UUID.',
  })
  @ApiNotFoundResponse({ type: OpenApiErrorDto })
  getMaterial(
    @Param('courseId', new ParseUUIDPipe({ version: '4' })) courseId: string,
    @Param('materialId', new ParseUUIDPipe({ version: '4' }))
    materialId: string,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<MaterialResponseDto> {
    return this.materialsService.getMaterial(
      courseId,
      materialId,
      request.user,
    )
  }
}
