import { useContext } from 'react'
import { useQuery, QueryClientContext } from '@tanstack/react-query'
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
  const client = useContext(QueryClientContext)
  if (!client) {
    return { data: undefined, isLoading: false, isError: false }
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
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
  const client = useContext(QueryClientContext)
  if (!client) {
    return { data: undefined, isLoading: false, isError: false }
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useQuery({
    ...studentReviewAllowanceQueryOptions(courseId ?? ''),
    enabled: Boolean(courseId && enabled),
  })
}
