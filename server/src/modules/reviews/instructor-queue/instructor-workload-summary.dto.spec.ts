import { instructorWorkloadSummaryQuerySchema } from './instructor-workload-summary.dto'

describe('Instructor workload summary query', () => {
  it('accepts an empty query object', () => {
    expect(instructorWorkloadSummaryQuerySchema.parse({})).toEqual({})
  })

  it('accepts a valid courseId uuid', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000'
    expect(
      instructorWorkloadSummaryQuerySchema.parse({ courseId: validUuid }),
    ).toEqual({ courseId: validUuid })
  })

  it('rejects an invalid courseId format', () => {
    expect(() =>
      instructorWorkloadSummaryQuerySchema.parse({ courseId: 'not-a-uuid' }),
    ).toThrow()
  })

  it('rejects unknown query fields', () => {
    expect(() =>
      instructorWorkloadSummaryQuerySchema.parse({ extra: 'field' }),
    ).toThrow()
  })
})
