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
    expect(screen.getByLabelText('Message citations')).toHaveTextContent(
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
})
