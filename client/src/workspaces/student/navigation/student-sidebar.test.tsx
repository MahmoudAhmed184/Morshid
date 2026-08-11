import '@testing-library/jest-dom/vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SidebarProvider, useSidebar } from '@/components/ui/sidebar'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import type { AuthSession } from '@/features/auth/session/session.schema'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { studentCourseAccessQueryOptions } from '@/features/courses/course-access/course-access.queries'
import { chatSessionKeys } from '@/features/chat/sessions/chat-sessions.queries'
import type { StudentCourseAccess } from '@/features/courses/course-access/course-access.schema'
import {
  StudentChromeProvider,
  useStudentSearchPalette,
} from '@/workspaces/student/navigation/student-chrome-context'
import { StudentCourseProvider } from '@/workspaces/student/navigation/student-course-context'
import { StudentSidebar } from '@/workspaces/student/navigation/student-sidebar'
import { StudentSearchPalette } from '@/workspaces/student/navigation/student-search-palette'
import {
  primaryChatSessionFixture,
  studentChatIds,
} from '@/features/chat/testing/chat.fixtures'

const navigateMock = vi.hoisted(() => vi.fn())
const routerMockState = vi.hoisted<{
  search: { courseId?: string; sessionId?: string }
  pathname: string
}>(() => ({ search: {}, pathname: '/chat' }))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    search,
    ...props
  }: {
    children?: React.ReactNode
    to: string
    search?: Record<string, string>
  }) => (
    <a
      href={search ? `${to}?${new URLSearchParams(search).toString()}` : to}
      {...props}
    >
      {children}
    </a>
  ),
  ScriptOnce: () => null,
  useNavigate: () => navigateMock,
  useRouterState: <T,>({
    select,
  }: {
    select: (state: {
      location: { pathname: string; search: Record<string, unknown> }
    }) => T
  }) =>
    select({
      location: {
        pathname: routerMockState.pathname,
        search: routerMockState.search,
      },
    }),
}))

const studentId = 'student-user'
const primaryCourse: StudentCourseAccess = {
  id: studentChatIds.primaryCourse,
  code: 'PYTHON-PROG-P0',
  title: 'Python Programming',
  membershipRole: 'STUDENT',
}
const otherCourse: StudentCourseAccess = {
  id: studentChatIds.otherCourse,
  code: 'JAVASCRIPT-P0',
  title: 'JavaScript Programming',
  membershipRole: 'STUDENT',
}

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function createStudentAuthSession(): AuthSession {
  return {
    tokenType: 'Bearer',
    user: {
      id: studentId,
      email: `${studentId}@morshid.test`,
      displayName: 'Test Student',
      role: 'STUDENT',
      status: 'ACTIVE',
    },
    accessToken: 'student-access-token',
    accessTokenExpiresAt: '2027-07-17T12:00:00.000Z',
  }
}

function ShellProbe() {
  const { state } = useSidebar()
  const { isOpen } = useStudentSearchPalette()
  return (
    <div
      data-testid="shell-probe"
      data-sidebar-state={state}
      data-search-open={String(isOpen)}
    />
  )
}

function renderCollapsedShell({
  courses = [primaryCourse],
  pathname = '/chat',
  search = {
    courseId: primaryCourse.id,
    sessionId: primaryChatSessionFixture.id,
  },
}: {
  courses?: StudentCourseAccess[]
  pathname?: string
  search?: { courseId?: string; sessionId?: string }
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
  routerMockState.search = search
  routerMockState.pathname = pathname

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  })
  queryClient.setQueryData(
    studentCourseAccessQueryOptions(studentId).queryKey,
    courses,
  )
  queryClient.setQueryData(
    chatSessionKeys.sessionList({ studentId, courseId: primaryCourse.id }),
    {
      pages: [{ sessions: [primaryChatSessionFixture], nextCursor: null }],
      pageParams: [undefined],
    },
  )

  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="test-theme">
        <SidebarProvider defaultOpen={false}>
          <StudentChromeProvider>
            <StudentCourseProvider>
              <StudentSidebar />
              <ShellProbe />
              <StudentSearchPalette />
            </StudentCourseProvider>
          </StudentChromeProvider>
        </SidebarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )

  const result = render(tree())

  // Moves the shell to another student route without remounting it, the way the
  // router does — this is what the Settings regression depends on.
  function goTo(
    nextPathname: string,
    nextSearch: { courseId?: string; sessionId?: string } = {},
  ) {
    routerMockState.pathname = nextPathname
    routerMockState.search = nextSearch
    result.rerender(tree())
  }

  return { ...result, goTo }
}

function collapsedCluster() {
  const cluster = document.querySelector('.glass-paper')
  if (!cluster) {
    throw new Error('Expected the collapsed cluster to be rendered')
  }
  return within(cluster as HTMLElement)
}

describe('StudentSidebar collapsed cluster', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('ResizeObserver', TestResizeObserver)
    Element.prototype.scrollIntoView = vi.fn()
    window.localStorage.clear()
    window.sessionStorage.clear()
    useAuthStore.getState().clearSession()
    useAuthStore.getState().setSession(createStudentAuthSession())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    useAuthStore.getState().clearSession()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('opens the search palette without expanding the sidebar (T15.8)', async () => {
    renderCollapsedShell()

    const probe = screen.getByTestId('shell-probe')
    expect(probe).toHaveAttribute('data-sidebar-state', 'collapsed')
    expect(probe).toHaveAttribute('data-search-open', 'false')

    fireEvent.click(
      collapsedCluster().getByRole('button', { name: 'Search your chats' }),
    )

    await waitFor(() =>
      expect(probe).toHaveAttribute('data-search-open', 'true'),
    )
    // The sidebar stays collapsed — the search icon no longer expands it.
    expect(probe).toHaveAttribute('data-sidebar-state', 'collapsed')
  })

  it('triggers New chat without expanding the sidebar (T15.7)', async () => {
    renderCollapsedShell()

    const probe = screen.getByTestId('shell-probe')
    fireEvent.click(
      collapsedCluster().getByRole('button', { name: 'New chat' }),
    )

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/chat',
        search: { courseId: primaryCourse.id },
      }),
    )
    expect(probe).toHaveAttribute('data-sidebar-state', 'collapsed')
  })

  it('preserves the active course for New chat and Search from Settings', async () => {
    window.sessionStorage.setItem(
      `morshid.student.active-course.${studentId}`,
      primaryCourse.id,
    )
    renderCollapsedShell({
      courses: [primaryCourse, otherCourse],
      pathname: '/settings',
      search: {},
    })

    fireEvent.click(
      collapsedCluster().getByRole('button', { name: 'New chat' }),
    )
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/chat',
        search: { courseId: primaryCourse.id },
      }),
    )

    fireEvent.click(
      collapsedCluster().getByRole('button', { name: 'Search your chats' }),
    )
    expect(
      await screen.findByRole('option', { name: /Python lists/ }),
    ).toBeVisible()
  })

  // Standards finding 3 / Spec finding 6 — walking a two-course student from the
  // chat workspace into Settings (where the URL carries no `courseId`) used to
  // leave New chat and the palette action inert.
  it('carries the active course into Settings after visiting a course', async () => {
    const { goTo } = renderCollapsedShell({
      courses: [primaryCourse, otherCourse],
      pathname: '/chat',
      search: { courseId: primaryCourse.id },
    })

    goTo('/settings')

    fireEvent.click(
      collapsedCluster().getByRole('button', { name: 'New chat' }),
    )
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/chat',
        search: { courseId: primaryCourse.id },
      }),
    )
  })

  // With no course to resolve at all, New chat must still take the student
  // somewhere actionable (`/chat` renders the course picker) rather than
  // silently doing nothing.
  it('sends the student to the workspace when no course can be resolved', async () => {
    renderCollapsedShell({
      courses: [primaryCourse, otherCourse],
      pathname: '/settings',
      search: {},
    })

    fireEvent.click(
      collapsedCluster().getByRole('button', { name: 'New chat' }),
    )

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({ to: '/chat', search: {} }),
    )
  })
})
