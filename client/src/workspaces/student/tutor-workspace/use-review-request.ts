import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { requestStudentReview } from '@/features/reviews/student-inbox/student-reviews.api'
import { chatSessionKeys } from '@/features/chat/sessions/chat-sessions.queries'
import { markMessageReviewPending } from '@/features/chat/messages/chat-message-history'
import type { MessageHistoryData } from '@/features/chat/messages/chat-message-history'
import type { StudentFlagReason } from '@/features/reviews/interface/student-review.schema'
import { allowancesKeys } from '@/features/allowances/interface'
import type { StudentAllowance } from '@/features/allowances/interface'

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
      queryClient.setQueryData<StudentAllowance>(
        allowancesKeys.reviews(courseId),
        (cached) =>
          cached
            ? {
                ...cached,
                used: cached.used + 1,
                remaining: Math.max(0, cached.remaining - 1),
              }
            : cached,
      )
      void queryClient.invalidateQueries({
        queryKey: allowancesKeys.reviews(courseId),
      })
      void queryClient.invalidateQueries({
        queryKey: chatSessionKeys.summary({
          studentId,
          courseId,
          sessionId,
        }),
      })
    },
  })
}
