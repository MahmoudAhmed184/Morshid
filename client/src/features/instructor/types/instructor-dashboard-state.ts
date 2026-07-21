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
      /** The course the panel currently displays. */
      course: InstructorCourse
      /**
       * All courses owned by the instructor. Used to render the course-panel
       * switcher when more than one exists (F4 merge). Optional so consumers
       * with a single course can omit it.
       */
      courses?: InstructorCourse[]
      /** Selects which owned course the panel displays. */
      onSelectCourse?: (courseId: string) => void
      materialCount: number
      reviewQueueCount: number
    }
