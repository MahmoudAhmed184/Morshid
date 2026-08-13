import { StudentFlagReason } from './review-values'
import { instructorReviewQueueQuerySchema } from './instructor-review-queue.dto'

describe('Instructor review queue query', () => {
  it.each(Object.values(StudentFlagReason))(
    'accepts Student flag reason %s',
    (studentFlagReason) => {
      expect(
        instructorReviewQueueQuerySchema.parse({ studentFlagReason }),
      ).toEqual({ studentFlagReason, limit: 25 })
    },
  )

  it('keeps the Student reason filter optional', () => {
    expect(instructorReviewQueueQuerySchema.parse({})).toEqual({ limit: 25 })
  })

  it('rejects an invalid Student reason filter', () => {
    expect(() =>
      instructorReviewQueueQuerySchema.parse({
        studentFlagReason: 'UNKNOWN_REASON',
      }),
    ).toThrow()
  })
})
