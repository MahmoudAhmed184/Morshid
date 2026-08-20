import { useQuery } from '@tanstack/react-query'
import {
  studentTutoringAllowanceQueryOptions,
  studentReviewAllowanceQueryOptions,
} from '../allowances.queries'
import type { StudentAllowance } from '../allowances.schema'

export function useStudentTutoringAllowance(courseId?: string): {
  data: StudentAllowance | undefined
  isLoading: boolean
  isError: boolean
} {
  return useQuery({
    ...studentTutoringAllowanceQueryOptions(courseId ?? ''),
    enabled: Boolean(courseId),
  })
}

export function useStudentReviewAllowance(
  courseId?: string,
  enabled = true,
): {
  data: StudentAllowance | undefined
  isLoading: boolean
  isError: boolean
} {
  return useQuery({
    ...studentReviewAllowanceQueryOptions(courseId ?? ''),
    enabled: Boolean(courseId && enabled),
  })
}
