import type { CourseMembership } from '@/features/courses/course-membership/course-membership.schema'
import type { InstructorReviewWorkloadSummary } from '@/features/reviews/interface/instructor-review.schema'

export type InstructorDashboardState =
  | { status: 'loading' }
  | { status: 'empty' }
  | {
      status: 'error'
      onRetry?: () => void
      isRetrying?: boolean
    }
  | {
      status: 'ready'
      course: CourseMembership
      courses: CourseMembership[]
      onSelectCourse?: (courseId: string) => void
      materialCount?: number
      reviewQueueCount?: number
      workloadSummary?: InstructorReviewWorkloadSummary
    }
