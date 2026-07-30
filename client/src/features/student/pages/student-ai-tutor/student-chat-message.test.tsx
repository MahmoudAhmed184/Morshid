import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ChatMessage } from '@/features/student/schemas/student-chat.schema'
import {
  orderedChatMessagesFixture,
  studentChatIds,
} from '@/features/student/testing/student-chat.fixtures'
import { ApiError } from '@/lib/api/http'

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
          onRequestReview={() => Promise.resolve()}
        />
      </ol>,
    )

    expect(screen.getByText('GROUNDED IN COURSE SOURCES')).toBeVisible()
    expect(screen.getByLabelText('Inline citations')).toHaveTextContent(
      '[1] Python lists',
    )
    expect(screen.getByRole('button', { name: 'Copy response' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Like response' })).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Dislike response' }),
    ).toBeVisible()
  })

  it('keeps response feedback local and mutually exclusive', async () => {
    const user = userEvent.setup()
    renderMessage(assistantMessage)
    const like = screen.getByRole('button', { name: 'Like response' })
    const dislike = screen.getByRole('button', { name: 'Dislike response' })

    await user.click(like)
    expect(like).toHaveAttribute('aria-pressed', 'true')
    expect(like).toHaveClass('text-info')
    expect(dislike).toHaveAttribute('aria-pressed', 'false')

    await user.click(dislike)
    expect(like).toHaveAttribute('aria-pressed', 'false')
    expect(dislike).toHaveAttribute('aria-pressed', 'true')
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
          onRequestReview={() => Promise.resolve()}
        />
      </ol>,
    )

    expect(screen.getByText(label)).toBeVisible()
  })

  it('shows review action only for eligible completed Assistant messages', () => {
    const { rerender } = renderMessage(assistantMessage)
    expect(screen.getByRole('button', { name: 'Request review' })).toBeVisible()

    rerender(messageElement({ ...assistantMessage, status: 'FAILED' }))
    expect(
      screen.queryByRole('button', { name: 'Request review' }),
    ).not.toBeInTheDocument()

    rerender(messageElement(orderedChatMessagesFixture[0]))
    expect(
      screen.queryByRole('button', { name: 'Request review' }),
    ).not.toBeInTheDocument()
  })

  it('opens an accessible note dialog and enforces the 200-character limit', async () => {
    const user = userEvent.setup()
    renderMessage(assistantMessage)
    await openRequestReview(user)

    expect(screen.getByRole('dialog')).toBeVisible()
    const note = screen.getByRole('textbox', { name: 'Note (optional)' })
    await user.type(note, 'x'.repeat(201))
    expect(note).toHaveValue('x'.repeat(200))
    expect(screen.getByText('0 characters remaining')).toBeVisible()
  })

  it('renders pending immediately after a successful request and hides the action', async () => {
    const user = userEvent.setup()
    render(<ReviewHarness />)
    await openRequestReview(user)
    await user.type(
      screen.getByRole('textbox', { name: 'Note (optional)' }),
      '  Please check  ',
    )
    await user.click(screen.getByRole('button', { name: 'Submit request' }))

    expect(await screen.findByText('Pending review')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Request review' }),
    ).not.toBeInTheDocument()
  })

  it('renders durable pending state supplied by chat history', () => {
    renderMessage({
      ...assistantMessage,
      reviewSummary: {
        reviewCaseId: studentChatIds.primarySession,
        status: 'PENDING',
      },
    })
    expect(screen.getByText('Pending review')).toBeVisible()
  })

  it('shows a friendly quota error without backend details', async () => {
    const user = userEvent.setup()
    renderMessage(assistantMessage, () =>
      Promise.reject(
        new ApiError(
          'internal quota details',
          429,
          'MANUAL_REVIEW_QUOTA_EXCEEDED',
        ),
      ),
    )
    await openRequestReview(user)
    await user.click(screen.getByRole('button', { name: 'Submit request' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You have reached today’s review request limit.',
    )
    expect(screen.queryByText('internal quota details')).not.toBeInTheDocument()
  })
})

function messageElement(
  message: ChatMessage,
  onRequestReview: (input: {
    messageId: string
    note: string
  }) => Promise<unknown> = vi.fn(() => Promise.resolve()),
) {
  return (
    <ol>
      <StudentChatMessage
        message={message}
        isGenerationActive={false}
        retryError={null}
        onRetry={() => undefined}
        onRequestReview={onRequestReview}
      />
    </ol>
  )
}

function renderMessage(
  message: ChatMessage,
  onRequestReview: (input: {
    messageId: string
    note: string
  }) => Promise<unknown> = vi.fn(() => Promise.resolve()),
) {
  return render(messageElement(message, onRequestReview))
}

function ReviewHarness() {
  const [message, setMessage] = useState(assistantMessage)
  return messageElement(message, ({ messageId }) => {
    setMessage({
      ...message,
      reviewSummary: {
        reviewCaseId: messageId,
        status: 'PENDING',
      },
    })
    return Promise.resolve()
  })
}

async function openRequestReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Request review' }))
}
