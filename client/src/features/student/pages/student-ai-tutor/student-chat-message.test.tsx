import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ChatMessage } from '@/features/student/schemas/student-chat.schema'
import { orderedChatMessagesFixture } from '@/features/student/testing/student-chat.fixtures'

import { StudentChatMessage } from './student-chat-message'

const assistantMessage: ChatMessage = {
  ...orderedChatMessagesFixture[1],
  citations: orderedChatMessagesFixture[1].citations.map((citation) => ({
    ...citation,
    evidence: citation.evidence.map((evidence) => ({ ...evidence })),
  })),
}

describe('StudentChatMessage', () => {
  afterEach(cleanup)

  it('shows grounded guidance and citation chips on tutor responses', () => {
    render(
      <ol>
        <StudentChatMessage
          message={assistantMessage}
          isGenerationActive={false}
          retryError={null}
          onRetry={() => undefined}
        />
      </ol>,
    )

    expect(screen.getByText('GROUNDED IN COURSE SOURCES')).toBeVisible()
    expect(screen.getByLabelText('Inline citations')).toHaveTextContent(
      '[1] Python lists',
    )
  })

  it.each([
    ['GENERAL_NOT_FOUND', 'GENERAL GUIDANCE · NOT FROM COURSE SOURCES'],
    ['UNCERTAIN_AWAITING_REVIEW', 'AWAITING INSTRUCTOR REVIEW'],
    ['INSTRUCTOR_REVIEWED', 'INSTRUCTOR-REVIEWED'],
    ['REFUSAL', 'GUIDANCE REFUSED'],
  ] as const)('renders %s as %s', (guidanceLabel, label) => {
    render(
      <ol>
        <StudentChatMessage
          message={{ ...assistantMessage, guidanceLabel, citations: [] }}
          isGenerationActive={false}
          retryError={null}
          onRetry={() => undefined}
        />
      </ol>,
    )

    expect(screen.getByText(label)).toBeVisible()
  })

  it('preserves multiline Python whitespace in a distinct accessible code block', () => {
    const content = [
      'Why does this crash?',
      '```python',
      'def average(nums):',
      '    total = 0',
      '    return total / len(num)',
      '```',
    ].join('\n')

    render(
      <ol>
        <StudentChatMessage
          message={{
            ...orderedChatMessagesFixture[0],
            content,
            requestKind: 'CODE_DIAGNOSIS',
          }}
          isGenerationActive={false}
          retryError={null}
          onRetry={() => undefined}
        />
      </ol>,
    )

    const code = screen.getByLabelText('python code')
    expect(code).toBeVisible()
    expect(code.textContent).toBe(
      [
        'def average(nums):',
        '    total = 0',
        '    return total / len(num)',
      ].join('\n'),
    )
  })

  it('renders a restored static diagnosis, inline code, label, and citations', () => {
    const restoredDiagnosis: ChatMessage = {
      ...assistantMessage,
      requestKind: 'CODE_DIAGNOSIS',
      content: [
        'Likely defect',
        'The name `num` does not match `nums`.',
        '',
        'Python concept',
        'Python name lookup uses local scope. [1]',
        '',
        'Next inspection step',
        'Compare the return expression names.',
      ].join('\n'),
    }

    const { container } = render(
      <ol>
        <StudentChatMessage
          message={restoredDiagnosis}
          isGenerationActive={false}
          retryError={null}
          onRetry={() => undefined}
        />
      </ol>,
    )

    expect(screen.getByText('STATIC PYTHON DIAGNOSIS')).toBeVisible()
    expect(screen.getByText('GROUNDED IN COURSE SOURCES')).toBeVisible()
    expect(screen.getByText('num', { selector: 'code' })).toBeVisible()
    expect(screen.getByText('nums', { selector: 'code' })).toBeVisible()
    expect(screen.getByLabelText('Inline citations')).toHaveTextContent(
      '[1] Python lists',
    )
    expect(container).toHaveTextContent('Compare the return expression names.')
  })
})
