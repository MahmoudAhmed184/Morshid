import { AnalysisConfidencePolicy } from './analysis-confidence-policy'

describe('AnalysisConfidencePolicy', () => {
  it('rejects confidence immediately below the 0.6 threshold', () => {
    const policy = new AnalysisConfidencePolicy({ threshold: 0.6 })

    expect(policy.accepts({ confidence: 0.599 })).toBe(false)
  })

  it('accepts confidence exactly equal to the 0.6 threshold', () => {
    const policy = new AnalysisConfidencePolicy({ threshold: 0.6 })

    expect(policy.accepts({ confidence: 0.6 })).toBe(true)
  })

  it('accepts confidence immediately above the 0.6 threshold', () => {
    const policy = new AnalysisConfidencePolicy({ threshold: 0.6 })

    expect(policy.accepts({ confidence: 0.601 })).toBe(true)
  })

  it.each([-0.01, 1.01, Number.NaN])(
    'rejects invalid threshold %s',
    (threshold) => {
      expect(() => new AnalysisConfidencePolicy({ threshold })).toThrow(
        /Invalid analysis confidence threshold/,
      )
    },
  )
})
