import type {
  InstructorReviewQueueItem,
  StudentFlagReason,
} from '@/features/reviews/interface/instructor-review.schema'

export type QueueStatus = 'ALL' | InstructorReviewQueueItem['status']
export type QueueTrigger = InstructorReviewQueueItem['trigger']

export interface QueueFilterCriteria {
  search?: string
  status?: QueueStatus
  courseId?: string | null
  trigger?: QueueTrigger | null
  studentFlagReason?: StudentFlagReason | null
}

export interface SavedQueueFilter {
  id: string
  name: string
  criteria: QueueFilterCriteria
  createdAt: string
  updatedAt?: string
}

export interface InstructorWorkspacePreferences {
  activeCourseId: string | null
  savedFilters: SavedQueueFilter[]
}
