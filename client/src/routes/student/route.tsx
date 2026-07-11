import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthLoader } from '@/features/auth/components/auth-loader'
import { StudentShellPage } from '@/features/student/student-shell-page'
import { requireRole } from '@/features/auth/utils/auth-redirect'

export const Route = createFileRoute('/student')({
  ssr: false,
  beforeLoad: async () => {
    const redirectPath = await requireRole('STUDENT')

    if (redirectPath) {
      throw redirect({ to: redirectPath })
    }
  },
  component: StudentShellPage,
  pendingComponent: AuthLoader,
  pendingMs: 200,
  pendingMinMs: 400,
  head: () => ({
    meta: [{ title: 'Student — Morshid' }],
  }),
})
