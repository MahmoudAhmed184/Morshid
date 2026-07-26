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
import { UserRole } from '../../generated/prisma/client'
import type { AuthenticatedHttpRequest } from '../auth/auth.guard'
import { Roles } from '../auth/roles.decorator'
import {
  CourseListResponseDto,
  MaterialManageableCourseListResponseDto,
} from './courses.dto'
import { CoursesService } from './courses.service'

@ApiTags('courses')
@Controller('courses')
@ApiAccessTokenAuth()
@UseInterceptors(ClassSerializerInterceptor)
@SerializeOptions({ type: CourseListResponseDto, strategy: 'excludeAll' })
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('material-management')
  @Roles(UserRole.INSTRUCTOR)
  @SerializeOptions({
    type: MaterialManageableCourseListResponseDto,
    strategy: 'excludeAll',
  })
  @ApiOperation({ summary: 'List courses manageable by the Instructor' })
  @ApiOkResponse({
    type: MaterialManageableCourseListResponseDto,
    description:
      'Courses where the authenticated Instructor has an active Instructor membership.',
  })
  listMaterialManageableCourses(
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<MaterialManageableCourseListResponseDto> {
    return this.coursesService.listMaterialManageableCourses(request.user)
  }

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
