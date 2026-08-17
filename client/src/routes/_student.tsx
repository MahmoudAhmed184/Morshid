import { createFileRoute, redirect } from '@tanstack/react-router'

import { RouteLoadError } from '@/app/route-load-error'
import { AuthLoader } from '@/features/auth/routing/auth-loader'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { requireRole } from '@/features/auth/routing/interface/auth-redirect'
import { studentCourseAccessQueryOptions } from '@/features/courses/course-access/course-access.queries'
import { StudentLayout } from '@/workspaces/student/student-layout'

export const Route = createFileRoute('/_student')({
  ssr: false,
  beforeLoad: async () => {
    const redirectPath = await requireRole('STUDENT')

    if (redirectPath) {
      throw redirect({ to: redirectPath })
    }
  },
  loader: ({ context }) => {
    const studentId = useAuthStore.getState().user?.id

    if (!studentId) {
      throw new Error('Student course loading requires an authenticated user')
    }

    return context.queryClient.ensureQueryData(
      studentCourseAccessQueryOptions(studentId),
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
