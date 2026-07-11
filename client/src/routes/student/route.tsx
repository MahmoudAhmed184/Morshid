import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthLoader } from '@/features/auth/components/auth-loader'
import { AuthRouteError } from '@/features/auth/components/auth-route-error'
import { StudentShellPage } from '@/features/student/student-shell-page'
import { studentCoursesQueryOptions } from '@/features/student/queries/student-courses.query'
import { requireRole } from '@/features/auth/utils/auth-redirect'
import { getAppQueryClient } from '@/lib/query/query-client'

export const Route = createFileRoute('/student')({
  ssr: false,
  beforeLoad: async () => {
    const redirectPath = await requireRole('STUDENT')

    if (redirectPath) {
      throw redirect({ to: redirectPath })
    }
  },
  loader: () => getAppQueryClient().ensureQueryData(studentCoursesQueryOptions),
  component: StudentShellPage,
  errorComponent: AuthRouteError,
  pendingComponent: AuthLoader,
  pendingMs: 200,
  pendingMinMs: 400,
  head: () => ({
    meta: [{ title: 'Student — Morshid' }],
  }),
})
