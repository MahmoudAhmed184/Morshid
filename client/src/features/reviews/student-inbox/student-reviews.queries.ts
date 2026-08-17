import { queryOptions } from '@tanstack/react-query'

import { getStudentReviewDetail } from './student-reviews.api'

interface StudentReviewDetailScope {
  studentId: string
  reviewCaseId: string
}

export const studentReviewKeys = {
  detail: ({ studentId, reviewCaseId }: StudentReviewDetailScope) =>
    ['student-reviews', studentId, reviewCaseId, 'detail'] as const,
}

export function studentReviewDetailQueryOptions(
  scope: StudentReviewDetailScope,
) {
  return queryOptions({
    queryKey: studentReviewKeys.detail(scope),
    queryFn: () => getStudentReviewDetail({ reviewCaseId: scope.reviewCaseId }),
  })
}
