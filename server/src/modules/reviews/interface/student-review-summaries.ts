export interface StudentReviewSummary {
  messageId: string
  reviewCaseId: string
  status: 'PENDING' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED'
  outcome: 'APPROVED' | 'EDITED' | 'REPLACED' | 'REQUEST_REJECTED' | null
  resolvedAt: Date | null
}

export abstract class StudentReviewSummaries {
  abstract loadForMessages(
    messageIds: readonly string[],
    studentId: string,
  ): Promise<readonly StudentReviewSummary[]>
}
