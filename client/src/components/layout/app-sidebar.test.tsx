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

import { AppSidebar } from '@/components/layout/app-sidebar'
import { SidebarProvider, useSidebar } from '@/components/ui/sidebar'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthSession } from '@/features/auth/schemas/auth.schema'
import { ThemeProvider } from '@/providers/theme-provider'
import { studentCoursesQueryOptions } from '@/features/student/data/student-courses.queries'
import { studentSessionKeys } from '@/features/student/data/student-sessions.queries'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'
import {
  StudentChromeProvider,
  useStudentSearchPalette,
} from '@/features/student/components/student-chrome-context'
import {
  primaryChatSessionFixture,
  studentChatIds,
} from '@/features/student/testing/student-chat.fixtures'

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
const primaryCourse: StudentCourse = {
  id: studentChatIds.primaryCourse,
  code: 'PYTHON-PROG-P0',
  title: 'Python Programming',
  membershipRole: 'STUDENT',
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
      courses: [],
    },
    accessToken: 'student-access-token',
    accessTokenExpiresAt: '2027-07-17T12:00:00.000Z',
    refreshToken: 'student-refresh-token',
    refreshTokenExpiresAt: '2027-07-24T12:00:00.000Z',
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

function renderCollapsedShell() {
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
  routerMockState.search = {
    courseId: primaryCourse.id,
    sessionId: primaryChatSessionFixture.id,
  }
  routerMockState.pathname = '/chat'

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  })
  queryClient.setQueryData(studentCoursesQueryOptions(studentId).queryKey, [
    primaryCourse,
  ])
  queryClient.setQueryData(
    studentSessionKeys.sessionList({ studentId, courseId: primaryCourse.id }),
    {
      pages: [{ sessions: [primaryChatSessionFixture], nextCursor: null }],
      pageParams: [undefined],
    },
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="test-theme">
        <SidebarProvider defaultOpen={false}>
          <StudentChromeProvider>
            <AppSidebar role="student" />
            <ShellProbe />
          </StudentChromeProvider>
        </SidebarProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
}

function collapsedCluster() {
  const cluster = document.querySelector('.glass-paper')
  if (!cluster) {
    throw new Error('Expected the collapsed cluster to be rendered')
  }
  return within(cluster as HTMLElement)
}

describe('AppSidebar collapsed cluster', () => {
  beforeEach(() => {
    vi.resetAllMocks()
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
})
