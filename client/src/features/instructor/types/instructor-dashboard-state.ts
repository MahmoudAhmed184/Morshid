import type { InstructorCourse } from '@/features/instructor/schemas/instructor-course.schema'

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
      course: InstructorCourse
      materialCount: number
      reviewQueueCount: number
    }
