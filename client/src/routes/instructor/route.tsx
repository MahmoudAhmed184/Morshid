import { createFileRoute } from '@tanstack/react-router'

import { createProtectedRoleRouteOptions } from '@/features/auth/utils/protected-role-route'
import { InstructorLayout } from '@/features/instructor/components/instructor-layout'

export const Route = createFileRoute('/instructor')(
  createProtectedRoleRouteOptions('INSTRUCTOR', 'Instructor', InstructorLayout),
)
