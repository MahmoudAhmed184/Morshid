import { createFileRoute } from '@tanstack/react-router'

import { createProtectedRoleRouteOptions } from '@/features/auth/utils/protected-role-route'
import { InstructorLayout } from '@/features/instructor/components/instructor-layout'
import { InstructorRoutePending } from '@/features/instructor/components/instructor-route-pending'

const instructorRouteOptions = createProtectedRoleRouteOptions(
  'INSTRUCTOR',
  'Instructor',
  InstructorLayout,
)

export const Route = createFileRoute('/instructor')({
  ...instructorRouteOptions,
  // Initial session validation still uses AuthLoader (via InstructorRoutePending).
  // Authenticated in-dashboard navigations keep InstructorLayout mounted instead.
  pendingComponent: InstructorRoutePending,
  // Avoid forcing the pending UI for 400ms after auth has already resolved.
  pendingMinMs: 0,
})
