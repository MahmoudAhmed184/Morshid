import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthLoader } from '@/features/auth/components/auth-loader'
import { RouteLoadError } from '@/components/route-load-error'
import { useAuthStore } from '@/features/auth/stores/auth.store'
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
  loader: () => {
    const studentId = useAuthStore.getState().user?.id

    if (!studentId) {
      throw new Error('Student course loading requires an authenticated user')
    }

    return getAppQueryClient().ensureQueryData(
      studentCoursesQueryOptions(studentId),
    )
  },
  component: StudentShellPage,
  errorComponent: RouteLoadError,
  pendingComponent: AuthLoader,
  pendingMs: 200,
  pendingMinMs: 400,
  head: () => ({
    meta: [{ title: 'Student — Morshid' }],
  }),
})
