import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Req,
  SerializeOptions,
  UseInterceptors,
} from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import { ApiAccessTokenAuth } from '../../common/http/openapi.decorators'
import type { AuthenticatedHttpRequest } from '../auth/auth.guard'
import { CourseListResponseDto } from './courses.dto'
import { CoursesService } from './courses.service'

@ApiTags('courses')
@Controller('courses')
@ApiAccessTokenAuth()
@UseInterceptors(ClassSerializerInterceptor)
@SerializeOptions({ type: CourseListResponseDto, strategy: 'excludeAll' })
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOperation({ summary: 'List accessible courses' })
  @ApiOkResponse({
    type: CourseListResponseDto,
    description: 'Courses visible to the authenticated user.',
  })
  listCourses(
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<CourseListResponseDto> {
    return this.coursesService.listCoursesForUser(request.user)
  }
}
