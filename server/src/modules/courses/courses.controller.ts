import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { UserRole } from '../../generated/prisma/client'
import { AuthGuard, type AuthenticatedHttpRequest } from '../auth/auth.guard'
import { Roles } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { CoursesService } from './courses.service'

@ApiTags('courses')
@Controller('courses')
@ApiBearerAuth()
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.INSTRUCTOR, UserRole.STUDENT)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  listCourses(@Req() request: AuthenticatedHttpRequest) {
    return this.coursesService.listCoursesForUser(request.user)
  }
}
