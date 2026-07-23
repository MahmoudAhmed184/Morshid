import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/providers/theme-provider'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthSession } from '@/features/auth/schemas/auth.schema'
import { studentCoursesQueryOptions } from '@/features/student/data/student-courses.queries'
import { studentSessionKeys } from '@/features/student/data/student-sessions.queries'
import type {
  ChatSession,
  ChatSessionListResponse,
} from '@/features/student/schemas/student-chat.schema'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'
import {
  StudentChromeProvider,
  useStudentChromeActions,
} from '@/features/student/components/student-chrome-context'
import {
  primaryChatSessionFixture,
  studentChatIds,
} from '@/features/student/testing/student-chat.fixtures'

import { StudentSearchPalette } from './student-search-palette'

const navigateMock = vi.hoisted(() => vi.fn())
const routerMockState = vi.hoisted<{
  search: { courseId?: string; sessionId?: string }
}>(() => ({ search: {} }))

vi.mock('@tanstack/react-router', () => ({
  ScriptOnce: () => null,
  useNavigate: () => navigateMock,
  useRouterState: <T,>({
    select,
  }: {
    select: (state: { location: { search: Record<string, unknown> } }) => T
  }) => select({ location: { search: routerMockState.search } }),
}))

const studentId = 'student-user'
const primaryCourse: StudentCourse = {
  id: studentChatIds.primaryCourse,
  code: 'PYTHON-PROG-P0',
  title: 'Python Programming',
  membershipRole: 'STUDENT',
}
const secondSession: ChatSession = {
  ...primaryChatSessionFixture,
  id: studentChatIds.otherSession,
  title: 'Functions practice',
}

function createStudentAuthSession(id: string = studentId): AuthSession {
  return {
    tokenType: 'Bearer',
    user: {
      id,
      email: `${id}@morshid.test`,
      displayName: 'Test Student',
      role: 'STUDENT',
      status: 'ACTIVE',
      courses: [],
    },
    accessToken: 'student-access-token',
    accessTokenExpiresAt: '2027-07-17T12:00:00.000Z',
    refreshToken: 'student-refresh-token',
    refreshTokenExpiresAt: '2027-07-24T12:00:00.000Z',
  }
}

// Surfaces the palette open action so tests can drive it like the collapsed
// search icon does.
function PaletteOpener() {
  const { openSearchPalette } = useStudentChromeActions()
  return (
    <button type="button" onClick={() => openSearchPalette()}>
      open palette
    </button>
  )
}

function renderPalette({
  courseId = primaryCourse.id,
  sessionId,
  sessions,
}: {
  courseId?: string
  sessionId?: string
  sessions?: ChatSessionListResponse
} = {}) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
  routerMockState.search = { courseId, sessionId }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  })
  queryClient.setQueryData(studentCoursesQueryOptions(studentId).queryKey, [
    primaryCourse,
  ])
  if (courseId && sessions) {
    queryClient.setQueryData(
      studentSessionKeys.sessionList({ studentId, courseId }),
      { pages: [sessions], pageParams: [undefined] },
    )
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="test-theme">
        <StudentChromeProvider>
          <PaletteOpener />
          <StudentSearchPalette />
        </StudentChromeProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('StudentSearchPalette', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('ResizeObserver', TestResizeObserver)
    Element.prototype.scrollIntoView = vi.fn()
    routerMockState.search = { courseId: primaryCourse.id }
    window.localStorage.clear()
    useAuthStore.getState().clearSession()
    useAuthStore.getState().setSession(createStudentAuthSession())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
  })

  it('opens with Ctrl/Cmd+K and lists the loaded sessions', async () => {
    renderPalette({
      sessions: {
        sessions: [primaryChatSessionFixture, secondSession],
        nextCursor: null,
      },
    })

    fireEvent.keyDown(document.body, { key: 'k', metaKey: true })

    expect(
      await screen.findByPlaceholderText('Search your chats...'),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /New chat/ })).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: /Python lists/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: /Functions practice/ }),
    ).toBeInTheDocument()
  })

  it('filters the loaded sessions client-side by the query', async () => {
    renderPalette({
      sessions: {
        sessions: [primaryChatSessionFixture, secondSession],
        nextCursor: null,
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'open palette' }))
    const input = await screen.findByPlaceholderText('Search your chats...')
    fireEvent.change(input, { target: { value: 'functions' } })

    expect(
      screen.getByRole('option', { name: /Functions practice/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: /Python lists/ }),
    ).not.toBeInTheDocument()
    // The New chat action stays available regardless of the query.
    expect(screen.getByRole('option', { name: /New chat/ })).toBeInTheDocument()
  })

  it('navigates to a selected session', async () => {
    renderPalette({
      sessions: {
        sessions: [primaryChatSessionFixture, secondSession],
        nextCursor: null,
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'open palette' }))
    fireEvent.click(
      await screen.findByRole('option', { name: /Functions practice/ }),
    )

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/chat',
        search: { courseId: primaryCourse.id, sessionId: secondSession.id },
      }),
    )
  })

  it('opens the draft from the New chat action', async () => {
    routerMockState.search = {
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
    }
    renderPalette({
      courseId: primaryCourse.id,
      sessionId: primaryChatSessionFixture.id,
      sessions: { sessions: [primaryChatSessionFixture], nextCursor: null },
    })

    fireEvent.click(screen.getByRole('button', { name: 'open palette' }))
    fireEvent.click(await screen.findByRole('option', { name: /New chat/ }))

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/chat',
        search: { courseId: primaryCourse.id },
      }),
    )
  })
})
