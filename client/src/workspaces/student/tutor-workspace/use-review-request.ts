import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/session/session.store'
import { requestStudentReview } from '@/features/reviews/student-inbox/student-reviews.api'
import { chatSessionKeys } from '@/features/chat/sessions/chat-sessions.queries'
import { markMessageReviewPending } from '@/features/chat/messages/chat-message-history'
import type { MessageHistoryData } from '@/features/chat/messages/chat-message-history'
import type { StudentFlagReason } from '@/features/reviews/interface/student-review.schema'

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
    mutationFn: ({
      messageId,
      flagReason,
      note,
    }: {
      messageId: string
      flagReason: StudentFlagReason
      note: string
    }) =>
      requestStudentReview({
        messageId,
        flagReason,
        note,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (response) => {
      if (!studentId) return
      const queryKey = chatSessionKeys.messageList({
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
