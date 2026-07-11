import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma/prisma.module'
import { CourseAccessService } from './course-access.service'
import { CoursesController } from './courses.controller'
import { CoursesService } from './courses.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CoursesController],
  providers: [CoursesService, CourseAccessService],
  exports: [CoursesService, CourseAccessService],
})
export class CoursesModule {}
