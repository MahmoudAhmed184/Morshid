import type { StudentFlagReason } from './schemas/instructor-review.schema'

const studentFlagReasonLabels: Record<StudentFlagReason, string> = {
  INCORRECT: 'Seems incorrect',
  CONFUSING: 'Confusing or unclear',
  UNHELPFUL: 'Not helpful',
  COURSE_MISMATCH: 'Doesn’t match course material',
  TOO_MUCH_ANSWER: 'Gave away too much',
  OTHER: 'Other',
}

export const studentFlagReasons = Object.keys(
  studentFlagReasonLabels,
) as StudentFlagReason[]

export function studentFlagReasonLabel(reason: StudentFlagReason) {
  return studentFlagReasonLabels[reason]
}
