import { useQuery } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import { studentReviewDetailQueryOptions } from '@/features/student/data/student-reviews.queries'

interface UseStudentReviewDetailInput {
  reviewCaseId: string | null
  enabled: boolean
}

export function useStudentReviewDetail({
  reviewCaseId,
  enabled,
}: UseStudentReviewDetailInput) {
  const studentId = useAuthStore((state) => state.user?.id)
  const query = studentReviewDetailQueryOptions({
    studentId: studentId ?? 'anonymous',
    reviewCaseId: reviewCaseId ?? 'none',
  })

  return useQuery({
    ...query,
    enabled: enabled && studentId !== undefined && reviewCaseId !== null,
  })
}
