import { MessageRequestKind } from '../../generated/prisma/client'
import { CorrectnessSensitiveRequestClassifier } from './correctness-sensitive-request.classifier'

describe('CorrectnessSensitiveRequestClassifier', () => {
  const classifier = new CorrectnessSensitiveRequestClassifier()

  it.each([
    'Write the complete solution for my graded Python assignment',
    'How should this table be completed for the assignment?',
    'Give me the full code for this problem',
    'Can you solve my homework?',
  ])('classifies the bounded Sprint 3 assessment pattern: %s', (content) => {
    expect(classifier.classify(content)).toEqual({
      requestKind: MessageRequestKind.PROBLEM_LIKE,
      correctnessSensitive: true,
    })
  })

  it.each([
    'What does the assignment operator do in Python?',
    'Why does a for loop visit every list item?',
    'What is one safe way to practice list iteration?',
    'No course source covers this conceptual topic',
    'Explain how exams are graded',
    'What is a homework assignment?',
    'Show how this code works conceptually',
    'Provide a code example that demonstrates a loop',
    'Discuss implementation choices for this exercise',
    'What does an answer key mean?',
  ])(
    'does not turn routine conceptual language into a review: %s',
    (content) => {
      expect(classifier.classify(content)).toEqual({
        requestKind: MessageRequestKind.CONCEPTUAL,
        correctnessSensitive: false,
      })
    },
  )
})
