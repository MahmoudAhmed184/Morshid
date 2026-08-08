import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ChatMessage,
  StudentFlagReason,
} from '@/features/student/schemas/student-chat.schema'
import {
  orderedChatMessagesFixture,
  studentChatIds,
} from '@/features/student/testing/student-chat.fixtures'
import { ApiError } from '@/lib/api/http'

import { StudentChatMessage } from './student-chat-message'

const useStudentReviewDetailMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/student/hooks/use-student-review-detail', () => ({
  useStudentReviewDetail: useStudentReviewDetailMock,
}))

const assistantMessage: ChatMessage = {
  ...orderedChatMessagesFixture[1],
  citations: orderedChatMessagesFixture[1].citations.map((citation) => ({
    ...citation,
    evidence: citation.evidence.map((evidence) => ({ ...evidence })),
  })),
}

describe('StudentChatMessage', () => {
  afterEach(cleanup)
  beforeEach(() => {
    useStudentReviewDetailMock.mockReturnValue({
      data: undefined,
      isError: false,
      isPending: false,
    })
  })

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

  it('renders Tutor Markdown as structured, styled content', () => {
    renderMessage({
      ...assistantMessage,
      citations: [],
      content: [
        '## Python lists',
        '',
        'Use `append()` to add an item:',
        '',
        '- **Indexing** starts at zero.',
        '- Slices return part of a list.',
        '',
        '```python',
        'numbers = [1, 2, 3]',
        'numbers.append(4)',
        '```',
        '',
        '| Method | Purpose |',
        '| --- | --- |',
        '| `append()` | Add one item |',
      ].join('\n'),
    })

    expect(
      screen.getByRole('heading', { level: 4, name: 'Python lists' }),
    ).toBeVisible()
    expect(screen.getAllByRole('list')).toHaveLength(2)
    expect(screen.getByText('Indexing')).toHaveClass('font-semibold')
    const codeBlock = screen.getByText((_content, element) =>
      Boolean(
        element?.tagName === 'CODE' &&
        element.classList.contains('language-python'),
      ),
    )
    expect(codeBlock).toHaveTextContent('numbers.append(4)')
    expect(
      screen.getByRole('region', { name: 'Scrollable response table' }),
    ).toBeVisible()
    expect(screen.getByRole('table')).toBeVisible()
  })

  it('does not execute raw HTML or load Markdown images', () => {
    renderMessage({
      ...assistantMessage,
      content:
        '<script>dangerousCall()</script>\n\n![tracking pixel](https://example.test/pixel.png)',
    })

    expect(screen.queryByText('dangerousCall()')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('[Image: tracking pixel]')).toBeVisible()
  })

  it('preserves a nested heading outline within the chat surface', () => {
    renderMessage({
      ...assistantMessage,
      content: '# Topic\n## Section\n### Detail\n#### Note',
    })

    expect(
      screen.getByRole('heading', { level: 3, name: 'Topic' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 4, name: 'Section' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 5, name: 'Detail' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 6, name: 'Note' }),
    ).toBeVisible()
  })

  it('renders model-authored links as inert text', () => {
    renderMessage({
      ...assistantMessage,
      content:
        '[External](https://example.test/login) https://example.test/tracker [Relative](/account) [Fragment](#answer)',
    })

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('External')).toHaveAttribute(
      'title',
      'Links are disabled in Tutor responses',
    )
    expect(screen.getByText('Relative')).toHaveAttribute(
      'title',
      'Links are disabled in Tutor responses',
    )
  })

  it('keeps Student-authored Markdown-looking text literal', () => {
    renderMessage({
      ...orderedChatMessagesFixture[0],
      content: '**Do not render this as bold.**',
    })

    expect(screen.getByText('**Do not render this as bold.**')).toBeVisible()
    expect(
      screen.queryByText('Do not render this as bold.'),
    ).not.toBeInTheDocument()
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

  it('preserves multiline Python whitespace in an accessible code block', () => {
    renderMessage({
      ...orderedChatMessagesFixture[0],
      requestKind: 'CODE_DIAGNOSIS',
      content: [
        'Why does this crash?',
        '```python',
        'def average(nums):',
        '    total = 0',
        '    return total / len(num)',
        '```',
      ].join('\n'),
    })

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

  it('renders a restored static diagnosis with Markdown and its label', () => {
    renderMessage({
      ...assistantMessage,
      requestKind: 'CODE_DIAGNOSIS',
      content: [
        '### Likely defect',
        'The name `num` does not match `nums`.',
        '',
        '### Next inspection step',
        'Compare the return expression names.',
      ].join('\n'),
    })

    expect(screen.getByText('STATIC PYTHON DIAGNOSIS')).toBeVisible()
    expect(screen.getByText('num', { selector: 'code' })).toBeVisible()
    expect(screen.getByText('nums', { selector: 'code' })).toBeVisible()
    expect(
      screen.getByRole('heading', { level: 5, name: 'Likely defect' }),
    ).toBeVisible()
  })

  it.each([
    ['BLOCKED', 'REFUSAL'],
    ['COMPLETED', 'REFUSAL'],
  ] as const)(
    'does not label a %s %s response as a delivered diagnosis',
    (status, guidanceLabel) => {
      renderMessage({
        ...assistantMessage,
        requestKind: 'CODE_DIAGNOSIS',
        status,
        guidanceLabel,
        content: 'I cannot provide that response.',
      })

      expect(
        screen.queryByText('STATIC PYTHON DIAGNOSIS'),
      ).not.toBeInTheDocument()
    },
  )

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

  it('renders an accessibly named review reason radio group', async () => {
    const user = userEvent.setup()
    renderMessage(assistantMessage)
    await openRequestReview(user)

    const group = screen.getByRole('radiogroup', { name: 'Reason' })
    expect(group).toBeVisible()
    expect(screen.getAllByRole('radio')).toHaveLength(6)
  })

  it.each([
    ['Seems incorrect', 'INCORRECT'],
    ['Confusing or unclear', 'CONFUSING'],
    ['Not helpful', 'UNHELPFUL'],
    ['Doesn’t match course material', 'COURSE_MISMATCH'],
    ['Gave away too much', 'TOO_MUCH_ANSWER'],
    ['Other', 'OTHER'],
  ] as const)('maps %s to %s', async (label, value) => {
    const user = userEvent.setup()
    renderMessage(assistantMessage)
    await openRequestReview(user)

    const radio = screen.getByRole('radio', { name: label })
    expect(radio).toHaveAttribute('value', value)
    await user.click(radio)
    expect(radio).toBeChecked()
  })

  it('blocks submission until a category is selected', async () => {
    const user = userEvent.setup()
    const onRequestReview = vi.fn(() => Promise.resolve())
    renderMessage(assistantMessage, onRequestReview)
    await openRequestReview(user)
    await user.click(screen.getByRole('button', { name: 'Submit request' }))

    expect(onRequestReview).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a reason for requesting review.',
    )
  })

  it('supports keyboard selection and submits the selected value', async () => {
    const user = userEvent.setup()
    const onRequestReview = vi.fn(() => Promise.resolve())
    renderMessage(assistantMessage, onRequestReview)
    await openRequestReview(user)

    const incorrect = screen.getByRole('radio', { name: 'Seems incorrect' })
    const confusing = screen.getByRole('radio', {
      name: 'Confusing or unclear',
    })
    incorrect.focus()
    expect(incorrect).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(confusing).toHaveFocus()
    expect(confusing).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Submit request' }))
    expect(onRequestReview).toHaveBeenCalledWith({
      messageId: assistantMessage.id,
      flagReason: 'CONFUSING',
      note: '',
    })
  })

  it('submits a non-OTHER category without a note', async () => {
    const user = userEvent.setup()
    const onRequestReview = vi.fn(() => Promise.resolve())
    renderMessage(assistantMessage, onRequestReview)
    await openRequestReview(user)
    await user.click(screen.getByRole('radio', { name: 'Seems incorrect' }))
    await user.click(screen.getByRole('button', { name: 'Submit request' }))

    expect(onRequestReview).toHaveBeenCalledWith({
      messageId: assistantMessage.id,
      flagReason: 'INCORRECT',
      note: '',
    })
  })

  it('requires and trims a note for OTHER', async () => {
    const user = userEvent.setup()
    const onRequestReview = vi.fn(() => Promise.resolve())
    renderMessage(assistantMessage, onRequestReview)
    await openRequestReview(user)
    await user.click(screen.getByRole('radio', { name: 'Other' }))
    await user.click(screen.getByRole('button', { name: 'Submit request' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add a note when selecting Other.',
    )
    expect(onRequestReview).not.toHaveBeenCalled()

    await user.type(
      screen.getByRole('textbox', { name: 'Note (required)' }),
      '  Another concern  ',
    )
    await user.click(screen.getByRole('button', { name: 'Submit request' }))
    expect(onRequestReview).toHaveBeenCalledWith({
      messageId: assistantMessage.id,
      flagReason: 'OTHER',
      note: 'Another concern',
    })
  })

  it('disables dialog controls while submission is pending', async () => {
    const user = userEvent.setup()
    let resolveRequest: (() => void) | undefined
    const onRequestReview = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve
        }),
    )
    renderMessage(assistantMessage, onRequestReview)
    await openRequestReview(user)
    await user.click(screen.getByRole('radio', { name: 'Not helpful' }))
    await user.click(screen.getByRole('button', { name: 'Submit request' }))

    expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Not helpful' })).toBeDisabled()
    expect(
      screen.getByRole('textbox', { name: 'Note (optional)' }),
    ).toBeDisabled()

    resolveRequest?.()
  })

  it('renders pending immediately after a successful request and hides the action', async () => {
    const user = userEvent.setup()
    render(<ReviewHarness />)
    await openRequestReview(user)
    await user.click(screen.getByRole('radio', { name: 'Seems incorrect' }))
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
        outcome: null,
        resolvedAt: null,
        hasNotification: false,
      },
    })
    expect(screen.getByText('Pending review')).toBeVisible()
  })

  it('renders a review that is currently under review', () => {
    renderMessage(messageWithReview('IN_REVIEW', null))

    expect(screen.getByText('Under review')).toBeVisible()
    expect(
      screen.getByText('Review request is under review'),
    ).toBeInTheDocument()
  })

  it.each([
    ['APPROVED', 'Approved guidance', 'Approved published answer'],
    ['EDITED', 'Edited guidance', 'Edited published answer'],
    ['REPLACED', 'Replacement guidance', 'Replacement published answer'],
  ] as const)(
    'renders the %s outcome separately below the original message',
    (outcome, label, publishedContent) => {
      useStudentReviewDetailMock.mockReturnValue({
        data: reviewDetail({ outcome, publishedContent }),
        isError: false,
        isPending: false,
      })
      renderMessage(messageWithReview('RESOLVED', outcome))

      const outcomeCard = screen.getByRole('region', {
        name: 'Reviewed outcome',
      })
      expect(screen.getByText('Reviewed')).toBeVisible()
      expect(outcomeCard).toHaveTextContent(label)
      expect(outcomeCard).toHaveTextContent(publishedContent)
      expect(outcomeCard).not.toHaveTextContent(assistantMessage.content)
      expect(screen.getByText(assistantMessage.content)).toBeVisible()
    },
  )

  it('replaces the awaiting-review presentation with the terminal reviewed outcome', () => {
    useStudentReviewDetailMock.mockReturnValue({
      data: reviewDetail({
        outcome: 'EDITED',
        publishedContent: 'Edited published answer',
      }),
      isError: false,
      isPending: false,
    })
    renderMessage({
      ...messageWithReview('RESOLVED', 'EDITED'),
      guidanceLabel: 'UNCERTAIN_AWAITING_REVIEW',
    })

    expect(screen.getByText('Reviewed')).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Reviewed outcome' }),
    ).toHaveTextContent('Edited published answer')
    expect(
      screen.queryByText('AWAITING INSTRUCTOR REVIEW'),
    ).not.toBeInTheDocument()
  })

  it('renders only the student-facing rejection reason for a rejected review', () => {
    useStudentReviewDetailMock.mockReturnValue({
      data: {
        ...reviewDetail({
          outcome: 'REQUEST_REJECTED',
          publishedContent: null,
        }),
        status: 'REJECTED',
        rejectionReason: 'This request cannot be reviewed manually.',
        instructorName: 'Private Instructor',
        internalNotes: 'Private internal note',
      },
      isError: false,
      isPending: false,
    })
    renderMessage(messageWithReview('REJECTED', 'REQUEST_REJECTED'))

    const outcomeCard = screen.getByRole('region', {
      name: 'Reviewed outcome',
    })
    expect(screen.getByText('Review rejected')).toBeVisible()
    expect(outcomeCard).toHaveTextContent('Request rejected')
    expect(outcomeCard).toHaveTextContent(
      'This request cannot be reviewed manually.',
    )
    expect(outcomeCard).not.toHaveTextContent('Private Instructor')
    expect(outcomeCard).not.toHaveTextContent('Private internal note')
    expect(outcomeCard).not.toHaveTextContent('Unpublished internal content')
    expect(screen.getByText(assistantMessage.content)).toBeVisible()
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
    await user.click(screen.getByRole('radio', { name: 'Seems incorrect' }))
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
    flagReason: StudentFlagReason
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
    flagReason: StudentFlagReason
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
        outcome: null,
        resolvedAt: null,
        hasNotification: false,
      },
    })
    return Promise.resolve()
  })
}

async function openRequestReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Request review' }))
}

function messageWithReview(
  status: 'PENDING' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED',
  outcome: 'APPROVED' | 'EDITED' | 'REPLACED' | 'REQUEST_REJECTED' | null,
): ChatMessage {
  return {
    ...assistantMessage,
    reviewSummary: {
      reviewCaseId: studentChatIds.primarySession,
      status,
      outcome,
      resolvedAt:
        status === 'RESOLVED' || status === 'REJECTED'
          ? '2026-07-15T10:00:00.000Z'
          : null,
      hasNotification: status === 'RESOLVED' || status === 'REJECTED',
    },
  }
}

function reviewDetail({
  outcome,
  publishedContent,
}: {
  outcome: 'APPROVED' | 'EDITED' | 'REPLACED' | 'REQUEST_REJECTED'
  publishedContent: string | null
}) {
  return {
    reviewCaseId: studentChatIds.primarySession,
    status: 'RESOLVED' as const,
    outcome,
    publishedContent,
    rejectionReason: null,
    requestedAt: '2026-07-14T10:00:00.000Z',
    resolvedAt: '2026-07-15T10:00:00.000Z',
    messageId: assistantMessage.id,
    sessionId: studentChatIds.primarySession,
  }
}
