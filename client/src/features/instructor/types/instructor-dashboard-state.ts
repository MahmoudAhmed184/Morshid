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
      courses: InstructorCourse[]
      materialCount: number
      readyMaterialCount: number
      processingMaterialCount: number
      attentionMaterialCount: number
    }
