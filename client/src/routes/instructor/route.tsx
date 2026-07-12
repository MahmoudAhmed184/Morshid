import { createFileRoute } from '@tanstack/react-router'

import { createProtectedRoleRouteOptions } from '@/features/auth/utils/protected-role-route'

export const Route = createFileRoute('/instructor')(
  createProtectedRoleRouteOptions('INSTRUCTOR', 'Instructor'),
)
