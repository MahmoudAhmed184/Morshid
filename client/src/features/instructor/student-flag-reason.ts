import type { z } from 'zod'

import type { studentFlagReasonSchema } from './schemas/instructor-review.schema'

type StudentFlagReason = z.infer<typeof studentFlagReasonSchema>

const studentFlagReasonLabels: Record<StudentFlagReason, string> = {
  INCORRECT: 'Seems incorrect',
  CONFUSING: 'Confusing or unclear',
  UNHELPFUL: 'Not helpful',
  COURSE_MISMATCH: 'Doesn’t match course material',
  TOO_MUCH_ANSWER: 'Gave away too much',
  OTHER: 'Other',
}

export function studentFlagReasonLabel(reason: StudentFlagReason) {
  return studentFlagReasonLabels[reason]
}
