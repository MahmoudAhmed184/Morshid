import type { CourseEvidenceChunk } from '../../materials/materials.public'
import {
  CONTROLLED_SOURCE_CONFLICT_DETECTOR_VERSION,
  ControlledSourceConflictDetector,
} from './controlled-source-conflict.detector'

const QUESTION =
  'In Python, does / with two integers give an integer or a decimal result?'

describe('ControlledSourceConflictDetector', () => {
  const detector = new ControlledSourceConflictDetector()

  it('selects the canonical opposing rank-1/rank-2 claims from distinct materials', () => {
    expect(
      detector.detect(QUESTION, [
        chunk({
          materialId: 'material-modern',
          content:
            'In Python 3, / performs true division and produces a float result for two integers.',
          rank: 1,
        }),
        chunk({
          materialId: 'material-legacy',
          content:
            'For two integer operands, the / operator performs integer division and truncates the result.',
          rank: 2,
        }),
      ]),
    ).toMatchObject({
      detectorVersion: CONTROLLED_SOURCE_CONFLICT_DETECTOR_VERSION,
      kind: 'PYTHON_DIVISION',
      sources: [
        { materialId: 'material-modern', rank: 1 },
        { materialId: 'material-legacy', rank: 2 },
      ],
    })
  })

  it.each([
    'On which day is Question X scheduled?',
    'According to the uploaded materials, on which day is Question X scheduled?',
  ])('selects the controlled Question X schedule conflict: %s', (question) => {
    expect(
      detector.detect(question, [
        chunk({
          materialId: 'schedule-a',
          materialTitle: 'Course Schedule Notice A',
          content: 'Question X is scheduled for Monday.',
          rank: 1,
        }),
        chunk({
          materialId: 'schedule-b',
          materialTitle: 'Course Schedule Notice B',
          content: 'Question X is scheduled for Tuesday.',
          rank: 2,
        }),
      ]),
    ).toMatchObject({
      detectorVersion: CONTROLLED_SOURCE_CONFLICT_DETECTOR_VERSION,
      kind: 'QUESTION_X_SCHEDULE',
      sources: [
        { materialId: 'schedule-a', rank: 1 },
        { materialId: 'schedule-b', rank: 2 },
      ],
    })
  })

  it.each([
    {
      label: 'agreement',
      question: QUESTION,
      chunks: [
        chunk({ content: 'The / operator returns a float result.', rank: 1 }),
        chunk({
          materialId: 'material-b',
          content: 'True division produces a decimal value.',
          rank: 2,
        }),
      ],
    },
    {
      label: 'same material wording',
      question: QUESTION,
      chunks: [
        chunk({ content: 'The / operator returns a float result.', rank: 1 }),
        chunk({
          content: 'The / operator performs integer division.',
          rank: 2,
        }),
      ],
    },
    {
      label: 'unrelated question',
      question: 'How do Python dictionaries store keys?',
      chunks: conflictPair(),
    },
    {
      label: 'unrelated source text',
      question: QUESTION,
      chunks: [
        chunk({ content: 'Python lists preserve insertion order.', rank: 1 }),
        chunk({
          materialId: 'material-b',
          content: 'The / operator performs integer division.',
          rank: 2,
        }),
      ],
    },
    {
      label: 'lower-ranked conflict',
      question: QUESTION,
      chunks: [
        chunk({ content: 'The / operator returns a float result.', rank: 1 }),
        chunk({
          materialId: 'material-b',
          content: 'True division produces a decimal value.',
          rank: 2,
        }),
        chunk({
          materialId: 'material-c',
          content: 'The / operator performs integer division.',
          rank: 3,
        }),
      ],
    },
    {
      label: 'schedule agreement',
      question: 'On which day is Question X scheduled?',
      chunks: [
        chunk({
          content: 'Question X is scheduled for Monday.',
          rank: 1,
        }),
        chunk({
          materialId: 'material-b',
          content: 'The schedule says Question X is scheduled for Monday.',
          rank: 2,
        }),
      ],
    },
    {
      label: 'unrelated schedule text',
      question: 'On which day is Question X scheduled?',
      chunks: [
        chunk({ content: 'Question Y is scheduled for Monday.', rank: 1 }),
        chunk({
          materialId: 'material-b',
          content: 'Question X is scheduled for Tuesday.',
          rank: 2,
        }),
      ],
    },
  ])('keeps $label clean', ({ question, chunks }) => {
    expect(detector.detect(question, chunks)).toBeNull()
  })
})

function conflictPair(): CourseEvidenceChunk[] {
  return [
    chunk({ content: 'The / operator returns a float result.', rank: 1 }),
    chunk({
      materialId: 'material-b',
      content: 'The / operator performs integer division.',
      rank: 2,
    }),
  ]
}

function chunk(overrides: Partial<CourseEvidenceChunk>): CourseEvidenceChunk {
  return {
    chunkId: `chunk-${String(overrides.rank ?? 1)}`,
    materialId: 'material-a',
    materialTitle: 'Python source',
    chunkIndex: 0,
    content: 'The / operator returns a float result.',
    rank: 1,
    similarityScore: 0.9,
    embeddingModel: 'deterministic-embedding-v1',
    ...overrides,
  }
}
