import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/stores/auth.store'
import { requestStudentReview } from '@/features/student/data/student-reviews.api'
import { studentSessionKeys } from '@/features/student/data/student-sessions.queries'
import { markMessageReviewPending } from '@/features/student/hooks/student-chat-history'
import type { MessageHistoryData } from '@/features/student/hooks/student-chat-history'

interface UseStudentReviewRequestInput {
  courseId: string
  sessionId: string
}

export function useStudentReviewRequest({
  courseId,
  sessionId,
}: UseStudentReviewRequestInput) {
  const studentId = useAuthStore((state) => state.user?.id)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ messageId, note }: { messageId: string; note: string }) =>
      requestStudentReview({
        messageId,
        note: note.trim() || null,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (response) => {
      if (!studentId) return
      const queryKey = studentSessionKeys.messageList({
        studentId,
        courseId,
        sessionId,
      })
      queryClient.setQueryData<MessageHistoryData>(queryKey, (cached) =>
        markMessageReviewPending(
          cached,
          response.messageId,
          response.reviewSummary.reviewCaseId,
        ),
      )
    },
  })
}
