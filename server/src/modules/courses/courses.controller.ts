import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Req,
  SerializeOptions,
  UseInterceptors,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger'

import type { AuthenticatedHttpRequest } from '../auth/auth.guard'
import { CourseListResponseDto } from './courses.dto'
import { CoursesService } from './courses.service'

@ApiTags('courses')
@Controller('courses')
@ApiBearerAuth()
@UseInterceptors(ClassSerializerInterceptor)
@SerializeOptions({ type: CourseListResponseDto, strategy: 'excludeAll' })
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @ApiOkResponse({ type: CourseListResponseDto })
  listCourses(
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<CourseListResponseDto> {
    return this.coursesService.listCoursesForUser(request.user)
  }
}
