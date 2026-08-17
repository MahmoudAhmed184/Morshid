import { createFileRoute } from '@tanstack/react-router'

import { RouteLoadError } from '@/app/route-load-error'
import { createProtectedRoleRouteOptions } from '@/features/auth/routing/protected-role-route'
import { InstructorLayout } from '@/workspaces/instructor/instructor-layout'
import { InstructorRoutePending } from '@/workspaces/instructor/instructor-route-pending'

const instructorRouteOptions = createProtectedRoleRouteOptions(
  'INSTRUCTOR',
  'Instructor',
  InstructorLayout,
  RouteLoadError,
)

export const Route = createFileRoute('/instructor')({
  ...instructorRouteOptions,
  // Initial session validation still uses AuthLoader (via InstructorRoutePending).
  // Authenticated in-dashboard navigations keep InstructorLayout mounted instead.
  pendingComponent: InstructorRoutePending,
  // Avoid forcing the pending UI for 400ms after auth has already resolved.
  pendingMinMs: 0,
})
