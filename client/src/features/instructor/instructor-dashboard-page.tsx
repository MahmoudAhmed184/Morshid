import {
  BookOpen,
  Bell,
  CalendarDays,
  ClipboardList,
  FileClock,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Search,
  Settings,
  Sparkles,
  UsersRound,
  UserRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/custom/empty-state'
import { Logo } from '@/components/logo'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { AuthCourseSummary } from '@/features/auth/types/auth.types'
import { cn } from '@/lib/utils'

const p0PythonCourseCode = 'PYTHON-PROG-P0'

const navItems: {
  icon: LucideIcon
  isActive?: boolean
  label: string
}[] = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: BookOpen, isActive: true, label: 'My Courses' },
  { icon: ClipboardList, label: 'Review Queue' },
  { icon: UsersRound, label: 'Students' },
  { icon: FileText, label: 'Materials' },
  { icon: Bell, label: 'Notifications' },
]

function getPrimaryInstructorCourse(courses: AuthCourseSummary[]) {
  const pythonCourse = courses.find(
    (course) => course.code === p0PythonCourseCode,
  )

  if (pythonCourse) {
    return pythonCourse
  }

  return courses.length > 0 ? courses[0] : null
}

function getInitials(displayName: string) {
  return displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function SidebarNavItem({
  icon: Icon,
  isActive,
  label,
}: {
  icon: LucideIcon
  isActive?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex h-9 w-full items-center gap-2 rounded-[6px] px-3 text-left text-xs font-medium transition-colors',
        isActive
          ? 'bg-[#182238] text-[#dbe8ff] shadow-[inset_2px_0_0_#a9c7ff]'
          : 'text-[#8f9aaa] hover:bg-[#151d2a] hover:text-[#dbe8ff]',
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span>{label}</span>
    </button>
  )
}

function InstructorSidebar({ displayName }: { displayName?: string }) {
  return (
    <aside className="flex bg-[#111821] text-[#d7dfec] md:min-h-svh md:w-52 md:flex-col md:border-r md:border-[#273241]">
      <div className="flex min-h-16 items-center gap-3 border-b border-[#273241] px-4 md:min-h-20">
        <Logo
          className="size-8 rounded-[6px] bg-[#dbe8ff] text-[#0c1420]"
          iconClassName="size-4"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">Morshid</p>
          <p className="truncate text-[0.68rem] text-[#7f8da3]">
            Instructor Portal
          </p>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 py-3 md:flex-1 md:flex-col md:gap-1 md:overflow-visible">
        {navItems.map((item) => (
          <SidebarNavItem key={item.label} {...item} />
        ))}
      </nav>

      <div className="hidden border-t border-[#273241] px-3 py-4 md:block">
        <SidebarNavItem icon={Settings} label="Settings" />
        {displayName ? (
          <p className="mt-4 truncate px-3 text-[0.7rem] text-[#7f8da3]">
            {displayName}
          </p>
        ) : null}
      </div>
    </aside>
  )
}

function InstructorTopBar({
  displayName,
  email,
}: {
  displayName?: string
  email?: string
}) {
  const initials = displayName ? getInitials(displayName) : 'IN'

  return (
    <header className="flex min-h-16 items-center gap-4 border-b border-[#1d2b3b] bg-[#0b121b] px-4 md:px-6">
      <div className="hidden min-w-0 flex-1 items-center rounded-[6px] border border-[#26374a] bg-[#08111c] px-3 text-[#74849a] md:flex">
        <Search className="mr-2 size-4" aria-hidden />
        <input
          aria-label="Search course workspace"
          readOnly
          value=""
          placeholder="Search course, materials, or reviews..."
          className="h-8 w-full bg-transparent text-xs outline-none placeholder:text-[#74849a]"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Notifications"
          className="text-[#9ba9bc] hover:bg-[#142033] hover:text-white"
        >
          <Bell aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Help"
          className="text-[#9ba9bc] hover:bg-[#142033] hover:text-white"
        >
          <HelpCircle aria-hidden />
        </Button>
        <div className="ml-1 hidden text-right sm:block">
          <p className="max-w-40 truncate text-xs font-medium text-white">
            {displayName ?? 'Instructor'}
          </p>
          {email ? (
            <p className="max-w-40 truncate text-[0.68rem] text-[#7f8da3]">
              {email}
            </p>
          ) : null}
        </div>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#a9c7ff] text-xs font-semibold text-[#07111f]">
          {initials}
        </div>
      </div>
    </header>
  )
}

function MetricTile({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-[8px] border border-[#26374a] bg-[#0b1624]/80 px-4 py-3">
      <p className="text-[0.68rem] font-medium text-[#7f8da3] uppercase">
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  )
}

function CourseHero({ course }: { course: AuthCourseSummary }) {
  return (
    <Card className="rounded-[8px] border-[#26374a] bg-[#101c2b] py-0 text-white ring-0">
      <CardContent className="overflow-hidden px-0">
        <div className="relative min-h-56 p-5 sm:p-6">
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(135deg,#16243a_0%,#07131f_48%,#162844_100%)]"
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-35 [background-image:linear-gradient(#7fa7ff24_1px,transparent_1px),linear-gradient(90deg,#7fa7ff24_1px,transparent_1px)] [background-size:40px_40px]"
          />
          <div className="relative flex min-h-44 flex-col justify-between gap-8">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-[#dbe8ff] text-[#07111f]">
                  {course.code}
                </Badge>
                {course.membershipRole ? (
                  <Badge
                    variant="outline"
                    className="border-[#6f84a3] text-[#dbe8ff]"
                  >
                    {course.membershipRole}
                  </Badge>
                ) : null}
              </div>
              <div className="max-w-2xl space-y-2">
                <h2 className="text-3xl font-semibold text-white sm:text-4xl">
                  {course.title}
                </h2>
                <p className="max-w-xl text-sm leading-6 text-[#b0bfd2]">
                  Sprint 1 instructor shell for course materials and flagged
                  guidance review.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricTile label="Course" value="Active" />
              <MetricTile label="Materials" value="Placeholder" />
              <MetricTile label="Review Queue" value="0 Pending" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SectionHeader({
  description,
  title,
}: {
  description: string
  title: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="text-xs leading-5 text-[#7f8da3]">{description}</p>
    </div>
  )
}

function MaterialsPlaceholder() {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Materials"
        description="Shell view for course source readiness. Upload and ingestion are deferred."
      />
      <Card className="rounded-[8px] border-[#26374a] bg-[#101821] py-0 text-[#d7dfec] ring-0">
        <CardHeader className="border-b border-[#26374a] px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-sm text-white">
              <FileText className="size-4 text-[#a9c7ff]" aria-hidden />
              Course Materials
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <div className="flex h-8 min-w-44 items-center rounded-[6px] border border-[#26374a] bg-[#08111c] px-3 text-xs text-[#74849a]">
                <Search className="mr-2 size-3.5" aria-hidden />
                Search by title
              </div>
              <div className="flex h-8 items-center rounded-[6px] border border-[#26374a] px-3 text-xs text-[#9ba9bc]">
                All Topics
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 py-4">
          <div className="overflow-hidden rounded-[8px] border border-[#26374a]">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-[#0b121b] px-4 py-2 text-[0.68rem] font-medium text-[#7f8da3] uppercase">
              <span>Material Name</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            <div className="grid min-h-28 place-items-center px-4 py-8 text-center">
              <div className="max-w-sm space-y-2">
                <div className="mx-auto flex size-10 items-center justify-center rounded-[8px] bg-[#172235] text-[#a9c7ff]">
                  <FileClock className="size-5" aria-hidden />
                </div>
                <p className="text-sm font-medium text-white">
                  Materials are not connected yet
                </p>
                <p className="text-xs leading-5 text-[#7f8da3]">
                  This panel is reserved for Sprint 2 upload, processing, and
                  source readiness status.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function ReviewQueuePlaceholder() {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="Review Queue"
        description="Shell view for flagged responses. Review actions are deferred."
      />
      <Card className="rounded-[8px] border-[#26374a] bg-[#101821] py-0 text-[#d7dfec] ring-0">
        <CardHeader className="border-b border-[#26374a] px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-sm text-white">
              <ClipboardList className="size-4 text-[#a9c7ff]" aria-hidden />
              Review Queue
            </CardTitle>
            <div className="flex flex-wrap gap-2 text-xs">
              {['Pending / 0', 'AI Concerns', 'Student Requests'].map(
                (item) => (
                  <span
                    key={item}
                    className="rounded-[6px] border border-[#26374a] bg-[#08111c] px-3 py-1.5 text-[#9ba9bc]"
                  >
                    {item}
                  </span>
                ),
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 py-4">
          <div className="rounded-[8px] border border-dashed border-[#33445a] bg-[#0b121b] px-5 py-8 text-center">
            <div className="mx-auto flex size-10 items-center justify-center rounded-[8px] bg-[#172235] text-[#a9c7ff]">
              <ClipboardList className="size-5" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-medium text-white">
              No review requests yet
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#7f8da3]">
              Flagged exchanges will appear here after the Sprint 3 review
              workflow is implemented.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function NoCourseState() {
  return (
    <EmptyState
      icon={<BookOpen />}
      title="No assigned courses"
      description="This instructor account does not have a course assignment in the current auth session."
      className="min-h-56 rounded-[8px] border-[#33445a] bg-[#101821] text-[#d7dfec] [&_h2]:text-white [&_p]:text-[#7f8da3]"
    />
  )
}

export function InstructorDashboardPage() {
  const user = useAuthStore((state) => state.user)
  const course = user ? getPrimaryInstructorCourse(user.courses) : null

  return (
    <main className="min-h-svh bg-[#050b12] text-[#d7dfec]">
      <div className="md:grid md:min-h-svh md:grid-cols-[13rem_minmax(0,1fr)]">
        <InstructorSidebar displayName={user?.displayName} />

        <div className="min-w-0 bg-[#07111b]">
          <InstructorTopBar
            displayName={user?.displayName}
            email={user?.email}
          />

          <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 md:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="flex items-center gap-2 text-xs font-medium text-[#7f8da3]">
                  <Sparkles className="size-4 text-[#a9c7ff]" aria-hidden />
                  Instructor Workspace
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-white">
                  Instructor Dashboard
                </h1>
              </div>
              <div className="flex items-center gap-2 rounded-[8px] border border-[#26374a] bg-[#101821] px-3 py-2 text-xs text-[#9ba9bc]">
                <CalendarDays className="size-4 text-[#a9c7ff]" aria-hidden />
                Sprint 1 Shell
              </div>
            </div>

            {course ? <CourseHero course={course} /> : <NoCourseState />}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <MaterialsPlaceholder />
              <ReviewQueuePlaceholder />
            </div>

            {!user ? (
              <EmptyState
                icon={<UserRound />}
                title="Instructor session unavailable"
                description="Sign in with an instructor account to view this dashboard shell."
                className="min-h-48 rounded-[8px] border-[#33445a] bg-[#101821] text-[#d7dfec] [&_h2]:text-white [&_p]:text-[#7f8da3]"
              />
            ) : null}
          </section>
        </div>
      </div>
    </main>
  )
}
