import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChatDraftScope } from '@/features/chat/drafts/draft-storage'
import {
  createDraftStorageKey,
  saveDraft,
} from '@/features/chat/drafts/draft-storage'

import { StudentChatComposer } from './chat-composer'
import type { StudentChatComposerActions } from './chat-composer'
import { ApiError } from '@/lib/http/http'

const useStudentTutoringAllowanceMock = vi.hoisted(() => vi.fn())
const useStudentReviewAllowanceMock = vi.hoisted(() => vi.fn())
const useStudentCourseContextMock = vi.hoisted(() => vi.fn())
const useChatSessionSummaryMock = vi.hoisted(() => vi.fn())

vi.mock('@/features/allowances/interface', () => ({
  useStudentTutoringAllowance: useStudentTutoringAllowanceMock,
  useStudentReviewAllowance: useStudentReviewAllowanceMock,
}))

vi.mock('@/workspaces/student/navigation/student-course-context', () => ({
  useStudentCourseContext: useStudentCourseContextMock,
}))

vi.mock('@/workspaces/student/tutor-workspace/use-chat-sessions', () => ({
  useChatSessionSummary: useChatSessionSummaryMock,
}))

function createMockStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => {
      map.delete(key)
    },
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  }
}

describe('StudentChatComposer', () => {
  let mockStorage: Storage
  const scope: ChatDraftScope = {
    userId: 'student-1',
    courseId: 'course-1',
    sessionId: 'session-1',
  }

  beforeEach(() => {
    vi.useFakeTimers()
    mockStorage = createMockStorage()
    useStudentTutoringAllowanceMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    })
    useStudentReviewAllowanceMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    })
    useChatSessionSummaryMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    })
    useStudentCourseContextMock.mockReturnValue({
      courses: [
        { id: 'course-1', code: 'CS101', title: 'Intro to Computer Science' },
        { id: 'course-2', code: 'CS102', title: 'Data Structures' },
      ],
      activeCourse: {
        id: 'course-1',
        code: 'CS101',
        title: 'Intro to Computer Science',
      },
      unavailableCourseId: null,
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('restores draft on mount and renders accessible restoration notice without stealing focus', () => {
    saveDraft(scope, 'Previously saved question', mockStorage)

    render(
      <StudentChatComposer
        userId={scope.userId}
        courseId={scope.courseId}
        sessionId={scope.sessionId}
        debounceMs={100}
        storage={mockStorage}
        isGenerating={false}
        sendError={null}
        onDismissError={vi.fn()}
        onSend={vi.fn().mockResolvedValue(true)}
        onActionsReady={vi.fn()}
      />,
    )

    const textarea = screen.getByRole('textbox', { name: 'Message' })
    expect(textarea).toHaveValue('Previously saved question')

    const statusNotice = screen.getByRole('status')
    expect(statusNotice).toHaveTextContent(/draft restored from this device/i)
    expect(
      screen.getByRole('button', { name: 'Discard restored draft' }),
    ).toBeInTheDocument()
  })

  it('debounces autosave to storage when student types', () => {
    render(
      <StudentChatComposer
        userId={scope.userId}
        courseId={scope.courseId}
        sessionId={scope.sessionId}
        debounceMs={300}
        storage={mockStorage}
        isGenerating={false}
        sendError={null}
        onDismissError={vi.fn()}
        onSend={vi.fn().mockResolvedValue(true)}
        onActionsReady={vi.fn()}
      />,
    )

    const textarea = screen.getByRole('textbox', { name: 'Message' })
    fireEvent.change(textarea, {
      target: { value: 'How does recursion work?' },
    })

    // Before debounce fires
    expect(mockStorage.getItem(createDraftStorageKey(scope))).toBeNull()

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(300)
    })

    const storedRaw = mockStorage.getItem(createDraftStorageKey(scope))
    expect(storedRaw).toBeTruthy()
    expect(JSON.parse(storedRaw!).text).toBe('How does recursion work?')
  })

  it('discards draft when clicking Discard draft button', () => {
    saveDraft(scope, 'Old draft to discard', mockStorage)

    render(
      <StudentChatComposer
        userId={scope.userId}
        courseId={scope.courseId}
        sessionId={scope.sessionId}
        debounceMs={100}
        storage={mockStorage}
        isGenerating={false}
        sendError={null}
        onDismissError={vi.fn()}
        onSend={vi.fn().mockResolvedValue(true)}
        onActionsReady={vi.fn()}
      />,
    )

    const textarea = screen.getByRole('textbox', { name: 'Message' })
    expect(textarea).toHaveValue('Old draft to discard')

    const discardBtn = screen.getByRole('button', {
      name: 'Discard restored draft',
    })
    fireEvent.click(discardBtn)

    expect(textarea).toHaveValue('')
    expect(mockStorage.getItem(createDraftStorageKey(scope))).toBeNull()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('clears saved draft on successful send', async () => {
    saveDraft(scope, 'Question to send', mockStorage)
    const onSendMock = vi.fn().mockResolvedValue(true)

    render(
      <StudentChatComposer
        userId={scope.userId}
        courseId={scope.courseId}
        sessionId={scope.sessionId}
        debounceMs={100}
        storage={mockStorage}
        isGenerating={false}
        sendError={null}
        onDismissError={vi.fn()}
        onSend={onSendMock}
        onActionsReady={vi.fn()}
      />,
    )

    const textarea = screen.getByRole('textbox', { name: 'Message' })
    expect(textarea).toHaveValue('Question to send')

    const sendBtn = screen.getByRole('button', { name: 'Send message' })
    await act(async () => {
      fireEvent.click(sendBtn)
    })

    expect(onSendMock).toHaveBeenCalledWith(
      'Question to send',
      expect.any(String),
    )
    expect(textarea).toHaveValue('')
    expect(mockStorage.getItem(createDraftStorageKey(scope))).toBeNull()
  })

  it('retains draft text in composer and storage on failed send', async () => {
    saveDraft(scope, 'Question that will fail', mockStorage)
    const onSendMock = vi.fn().mockResolvedValue(false)

    render(
      <StudentChatComposer
        userId={scope.userId}
        courseId={scope.courseId}
        sessionId={scope.sessionId}
        debounceMs={100}
        storage={mockStorage}
        isGenerating={false}
        sendError={null}
        onDismissError={vi.fn()}
        onSend={onSendMock}
        onActionsReady={vi.fn()}
      />,
    )

    const textarea = screen.getByRole('textbox', { name: 'Message' })
    const sendBtn = screen.getByRole('button', { name: 'Send message' })

    await act(async () => {
      fireEvent.click(sendBtn)
    })

    expect(onSendMock).toHaveBeenCalledWith(
      'Question that will fail',
      expect.any(String),
    )
    // Draft remains in composer and storage
    expect(textarea).toHaveValue('Question that will fail')
    const storedRaw = mockStorage.getItem(createDraftStorageKey(scope))
    expect(storedRaw).toBeTruthy()
    expect(JSON.parse(storedRaw!).text).toBe('Question that will fail')
  })

  it('displays accessible storage error status if storage fails', () => {
    const failingStorage = createMockStorage()
    failingStorage.setItem = () => {
      throw new Error('QuotaExceededError')
    }

    render(
      <StudentChatComposer
        userId={scope.userId}
        courseId={scope.courseId}
        sessionId={scope.sessionId}
        debounceMs={100}
        storage={failingStorage}
        isGenerating={false}
        sendError={null}
        onDismissError={vi.fn()}
        onSend={vi.fn().mockResolvedValue(true)}
        onActionsReady={vi.fn()}
      />,
    )

    const textarea = screen.getByRole('textbox', { name: 'Message' })
    fireEvent.change(textarea, {
      target: { value: 'Text typed when quota is full' },
    })

    act(() => {
      vi.advanceTimersByTime(100)
    })

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/draft could not be saved to this device/i)
    expect(textarea).toHaveValue('Text typed when quota is full')
  })

  it('handles composer actions prefill and submitWith', () => {
    let actions: StudentChatComposerActions | null = null
    const onSendMock = vi.fn().mockResolvedValue(true)

    render(
      <StudentChatComposer
        userId={scope.userId}
        courseId={scope.courseId}
        sessionId={scope.sessionId}
        debounceMs={100}
        storage={mockStorage}
        isGenerating={false}
        sendError={null}
        onDismissError={vi.fn()}
        onSend={onSendMock}
        onActionsReady={(ready) => {
          actions = ready
        }}
      />,
    )

    expect(actions).toBeTruthy()

    act(() => {
      actions?.prefill('Prefilled prompt')
    })

    const textarea = screen.getByRole('textbox', { name: 'Message' })
    expect(textarea).toHaveValue('Prefilled prompt')
  })

  it('renders low allowance warning when remaining turns are 1-3', () => {
    useStudentTutoringAllowanceMock.mockReturnValue({
      data: {
        scope: 'TUTORING',
        used: 28,
        limit: 30,
        remaining: 2,
        policyDayWindow: {
          start: '2026-08-20T00:00:00.000Z',
          end: '2026-08-21T00:00:00.000Z',
          timeZone: 'Africa/Cairo',
        },
      },
      isLoading: false,
      isError: false,
    })

    render(
      <StudentChatComposer
        userId={scope.userId}
        courseId={scope.courseId}
        sessionId={scope.sessionId}
        debounceMs={100}
        storage={mockStorage}
        isGenerating={false}
        sendError={null}
        onDismissError={vi.fn()}
        onSend={vi.fn().mockResolvedValue(true)}
        onActionsReady={vi.fn()}
      />,
    )

    expect(screen.getByTestId('allowance-low-banner')).toHaveTextContent(
      '2 turns remaining today for this course.',
    )
  })

  it('disables input and send button when allowance is exhausted', () => {
    useStudentTutoringAllowanceMock.mockReturnValue({
      data: {
        scope: 'TUTORING',
        used: 30,
        limit: 30,
        remaining: 0,
        policyDayWindow: {
          start: '2026-08-20T00:00:00.000Z',
          end: '2026-08-21T00:00:00.000Z',
          timeZone: 'Africa/Cairo',
        },
      },
      isLoading: false,
      isError: false,
    })

    render(
      <StudentChatComposer
        userId={scope.userId}
        courseId={scope.courseId}
        sessionId={scope.sessionId}
        debounceMs={100}
        storage={mockStorage}
        isGenerating={false}
        sendError={null}
        onDismissError={vi.fn()}
        onSend={vi.fn().mockResolvedValue(true)}
        onActionsReady={vi.fn()}
      />,
    )

    expect(screen.getByTestId('allowance-exhausted-banner')).toHaveTextContent(
      'You have reached your daily tutoring allowance for this course (0 turns remaining).',
    )
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
  })

  it('renders friendly allowance exhausted error when API returns TUTORING_ALLOWANCE_EXHAUSTED', () => {
    const error = new ApiError('Exhausted', 429, 'TUTORING_ALLOWANCE_EXHAUSTED')

    render(
      <StudentChatComposer
        userId={scope.userId}
        courseId={scope.courseId}
        sessionId={scope.sessionId}
        debounceMs={100}
        storage={mockStorage}
        isGenerating={false}
        sendError={error}
        onDismissError={vi.fn()}
        onSend={vi.fn().mockResolvedValue(true)}
        onActionsReady={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'You have reached your daily tutoring allowance for this course.',
    )
  })

  it('renders course context dropdown, turns left, and review allowance pills', () => {
    useStudentReviewAllowanceMock.mockReturnValue({
      data: {
        scope: 'REVIEW',
        used: 1,
        limit: 3,
        remaining: 2,
        policyDayWindow: {
          start: '2026-08-20T00:00:00.000Z',
          end: '2026-08-21T00:00:00.000Z',
          timeZone: 'Africa/Cairo',
        },
      },
      isLoading: false,
      isError: false,
    })

    render(
      <StudentChatComposer
        userId={scope.userId}
        courseId={scope.courseId}
        sessionId={scope.sessionId}
        debounceMs={100}
        storage={mockStorage}
        isGenerating={false}
        sendError={null}
        onDismissError={vi.fn()}
        onSend={vi.fn().mockResolvedValue(true)}
        onActionsReady={vi.fn()}
      />,
    )

    expect(screen.getByLabelText(/course context: CS101/i)).toBeInTheDocument()
    expect(screen.getByText('Turns left 30 / 30')).toBeInTheDocument()
    expect(screen.getByText('Reviews left 2 / 3')).toBeInTheDocument()
  })

  it('disables composer and displays warning when per-conversation turn limit is reached', () => {
    const studentMessages = Array.from({ length: 30 }, (_, index) => ({
      id: `msg-${index}`,
      sequence: index + 1,
      role: 'STUDENT' as const,
      attemptId: null,
      topicId: null,
      responseToMessageId: null,
      content: `Question ${index}`,
      status: 'COMPLETED' as const,
      requestKind: null,
      guidanceLabel: null,
      hintLevel: null,
      promptVersion: null,
      errorCode: null,
      createdAt: '2026-08-20T12:00:00.000Z',
      completedAt: '2026-08-20T12:00:00.000Z',
      citations: [],
      reviewSummary: null,
    }))

    render(
      <StudentChatComposer
        userId={scope.userId}
        courseId={scope.courseId}
        sessionId={scope.sessionId}
        messages={studentMessages}
        debounceMs={100}
        storage={mockStorage}
        isGenerating={false}
        sendError={null}
        onDismissError={vi.fn()}
        onSend={vi.fn().mockResolvedValue(true)}
        onActionsReady={vi.fn()}
      />,
    )

    expect(screen.getByTestId('turn-limit-exhausted-banner')).toHaveTextContent(
      'You have reached the per-conversation limit of 30 turns for this session.',
    )
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
  })

  it('renders session summary popover with context usage, total processed, and progress', () => {
    render(
      <StudentChatComposer
        userId={scope.userId}
        courseId={scope.courseId}
        sessionId={scope.sessionId}
        debounceMs={100}
        storage={mockStorage}
        isGenerating={false}
        sendError={null}
        onDismissError={vi.fn()}
        onSend={vi.fn().mockResolvedValue(true)}
        onActionsReady={vi.fn()}
      />,
    )

    const infoButton = screen.getByRole('button', { name: 'Session summary' })
    expect(infoButton).toBeInTheDocument()

    fireEvent.click(infoButton)

    expect(screen.getByText('Session summary')).toBeInTheDocument()
    expect(screen.getByText('Context usage')).toBeInTheDocument()
    expect(screen.getByText('Total processed')).toBeInTheDocument()
    expect(screen.getByText('Progress in this chat')).toBeInTheDocument()
    expect(
      screen.getByText(/Each chat session is limited to 30 turns/i),
    ).toBeInTheDocument()
  })

  it('renders authoritative session summary data in popover and status row pills', () => {
    useChatSessionSummaryMock.mockReturnValue({
      data: {
        turnsUsed: 5,
        turnLimit: 30,
        turnsRemaining: 25,
        isTurnLimitExhausted: false,
        contextTokens: 42_000,
        maxContextTokens: 258_000,
        contextPercent: 16,
        totalProcessedTokens: 150_000,
        policyDay: '2026-08-20',
        policyTimeZone: 'Africa/Cairo',
        resetAt: '2026-08-21T00:00:00.000Z',
      },
      isLoading: false,
      isError: false,
    })

    useStudentReviewAllowanceMock.mockReturnValue({
      data: {
        limit: 3,
        used: 1,
        remaining: 2,
        resetAt: '2026-08-21T00:00:00.000Z',
        policyTimeZone: 'Africa/Cairo',
      },
      isLoading: false,
      isError: false,
    })

    render(
      <StudentChatComposer
        userId={scope.userId}
        courseId={scope.courseId}
        sessionId={scope.sessionId}
        debounceMs={100}
        storage={mockStorage}
        isGenerating={false}
        sendError={null}
        onDismissError={vi.fn()}
        onSend={vi.fn().mockResolvedValue(true)}
        onActionsReady={vi.fn()}
      />,
    )

    expect(screen.getByText('Turns left 25 / 30')).toBeInTheDocument()
    expect(screen.getByText('Reviews left 2 / 3')).toBeInTheDocument()

    const infoButton = screen.getByRole('button', { name: 'Session summary' })
    fireEvent.click(infoButton)

    expect(screen.getByText('16% · 42k/258k')).toBeInTheDocument()
    expect(screen.getByText('150k')).toBeInTheDocument()
    expect(screen.getByText('5/30 exchanges')).toBeInTheDocument()
  })
})
