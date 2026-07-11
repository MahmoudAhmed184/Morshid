import { useNavigate } from '@tanstack/react-router'
import {
  Bell,
  BookOpen,
  Bot,
  History,
  Home,
  LogOut,
  MessageSquareText,
  SendHorizontal,
  Search,
  Settings,
} from 'lucide-react'

import { Logo } from '@/components/logo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { logoutApi } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { cn } from '@/lib/utils'

const primaryNavItems = [
  { label: 'Dashboard', icon: Home, active: true },
  { label: 'Courses', icon: BookOpen, active: false },
  { label: 'AI Tutor', icon: Bot, active: false },
  { label: 'History', icon: History, active: false },
] as const

const secondaryNavItems = [
  { label: 'Notifications', icon: Bell },
  { label: 'Settings', icon: Settings },
] as const

function getInitials(name: string | undefined) {
  if (!name) {
    return 'S'
  }

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export function StudentShellPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const displayName = user?.displayName ?? 'Student'
  const initials = getInitials(displayName)
  const assignedCourses =
    user?.courses.filter((course) => course.membershipRole === 'STUDENT') ?? []
  const selectedCourse = assignedCourses.length > 0 ? assignedCourses[0] : null

  const handleLogout = async () => {
    const refreshToken = useAuthStore.getState().refreshToken

    try {
      if (refreshToken) {
        await logoutApi(refreshToken)
      }
    } catch {
      // Local logout must still complete if the revoke request is unavailable.
    } finally {
      clearSession()
      await navigate({ to: '/login' })
    }
  }

  return (
    <main className="min-h-svh bg-zinc-950 text-zinc-100">
      <div className="flex min-h-svh w-full overflow-hidden">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-zinc-900 px-4 py-5 md:flex">
          <div className="mb-8 flex items-center gap-3">
            <Logo
              className="size-9 rounded-md bg-blue-500 text-white"
              iconClassName="size-4"
            />
            <div>
              <p className="text-sm font-semibold text-white">Morshid</p>
              <p className="text-xs text-zinc-400">Student Portal</p>
            </div>
          </div>

          <nav className="space-y-1" aria-label="Student navigation">
            {primaryNavItems.map((item) => (
              <Button
                key={item.label}
                type="button"
                variant="ghost"
                className={cn(
                  'h-9 w-full justify-start gap-2 text-zinc-300 hover:bg-white/10 hover:text-white',
                  item.active && 'bg-teal-500 text-white hover:bg-teal-500',
                )}
                aria-current={item.active ? 'page' : undefined}
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </Button>
            ))}
          </nav>

          <section className="mt-7 border-t border-white/10 pt-5">
            <div className="mb-3">
              <h2 className="text-xs font-medium tracking-[0.12em] text-zinc-500 uppercase">
                Assigned Courses
              </h2>
            </div>
            {assignedCourses.length > 0 ? (
              <ul className="space-y-2" aria-label="Assigned courses">
                {assignedCourses.map((course) => (
                  <li
                    key={course.id}
                    className="rounded-md border border-white/10 bg-white/[0.04] p-3"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-100">
                          {course.title}
                        </p>
                        <p className="mt-1 truncate text-xs text-zinc-500">
                          {course.code}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-teal-400/30 text-teal-200"
                      >
                        Assigned
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-md border border-dashed border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-400">
                No courses assigned yet.
              </div>
            )}
          </section>

          <div className="mt-auto space-y-1 pt-6">
            {secondaryNavItems.map((item) => (
              <Button
                key={item.label}
                type="button"
                variant="ghost"
                className="h-9 w-full justify-start gap-2 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </Button>
            ))}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-[#06131f]">
          <header className="flex min-h-16 items-center gap-3 border-b border-white/10 px-4 sm:px-6">
            <div className="md:hidden">
              <Logo
                className="size-8 rounded-md bg-blue-500 text-white"
                iconClassName="size-4"
              />
            </div>

            <div className="relative hidden min-w-0 flex-1 sm:block">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500"
                aria-hidden
              />
              <Input
                type="search"
                aria-label="Search"
                placeholder="Search"
                className="h-9 border-white/10 bg-zinc-950/60 pl-9 text-zinc-100 placeholder:text-zinc-500 focus-visible:border-teal-400 focus-visible:ring-teal-400/20"
              />
            </div>

            <Badge className="hidden bg-teal-500/15 text-teal-200 sm:inline-flex">
              Student
            </Badge>

            <Avatar
              className="bg-zinc-800 text-zinc-100"
              aria-label={displayName}
            >
              <AvatarFallback className="bg-zinc-800 text-xs font-semibold text-zinc-100">
                {initials}
              </AvatarFallback>
            </Avatar>

            <Button
              type="button"
              variant="outline"
              onClick={handleLogout}
              className="border-white/10 bg-transparent text-zinc-100 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-4" aria-hidden />
              Log out
            </Button>
          </header>

          <div className="flex flex-1 flex-col px-4 py-5 sm:px-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-zinc-400">Student Workspace</p>
                <h1 className="text-2xl font-semibold text-white sm:text-3xl">
                  AI Tutor
                </h1>
              </div>
            </div>

            <section
              className="flex min-h-96 flex-1 flex-col rounded-md border border-white/10 bg-zinc-950/40"
              aria-labelledby="student-chat-title"
            >
              <header className="flex min-h-16 flex-col justify-center gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-[0.12em] text-zinc-500 uppercase">
                    Course Context
                  </p>
                  <h2
                    id="student-chat-title"
                    className="mt-1 truncate text-base font-semibold text-white"
                  >
                    {selectedCourse?.title ?? 'No course selected'}
                  </h2>
                  <p className="mt-1 truncate text-sm text-zinc-500">
                    {selectedCourse?.code ??
                      'Select an assigned course when course chat is connected.'}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="w-fit border-amber-300/30 text-amber-200"
                >
                  Chat not connected
                </Badge>
              </header>

              <div className="flex flex-1 items-center justify-center px-4 py-12 text-center">
                <div className="max-w-sm">
                  <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-md bg-teal-500/15 text-teal-200">
                    <MessageSquareText className="size-6" aria-hidden />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    No conversation yet
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Course-grounded chat is not available yet. This area is
                    reserved for Sprint 2 integration.
                  </p>
                </div>
              </div>

              <footer className="border-t border-white/10 p-4">
                <div className="rounded-md border border-white/10 bg-zinc-950/60 p-3">
                  <Textarea
                    aria-label="Message"
                    disabled
                    placeholder="Chat is not connected yet."
                    className="min-h-20 resize-none border-white/10 bg-transparent text-zinc-100 placeholder:text-zinc-500"
                  />
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-zinc-500">
                      Chat is not available yet. Messages cannot be sent.
                    </p>
                    <Button type="button" disabled aria-label="Send message">
                      <SendHorizontal className="size-4" aria-hidden />
                      Send
                    </Button>
                  </div>
                </div>
              </footer>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}
