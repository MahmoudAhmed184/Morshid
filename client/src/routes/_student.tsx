import { createFileRoute, redirect } from '@tanstack/react-router'

import { RouteLoadError } from '@/components/route-load-error'
import { AuthLoader } from '@/features/auth/components/auth-loader'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { requireRole } from '@/features/auth/utils/auth-redirect'
import { studentCoursesQueryOptions } from '@/features/student/data/student-courses.queries'
import { StudentLayout } from '@/features/student/pages/student-layout'
import { getAppQueryClient } from '@/lib/query/query-client'

export const Route = createFileRoute('/_student')({
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
  component: StudentLayout,
  errorComponent: RouteLoadError,
  pendingComponent: AuthLoader,
  pendingMs: 200,
  pendingMinMs: 400,
  head: () => ({
    meta: [{ title: 'Morshid' }],
  }),
})
