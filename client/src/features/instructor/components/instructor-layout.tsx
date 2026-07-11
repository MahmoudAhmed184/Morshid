import { Outlet, Link, useLocation } from '@tanstack/react-router'
import {
  BarChart3,
  Bell,
  BookOpen,
  ClipboardList,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Logo } from '@/components/logo'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { cn } from '@/lib/utils'

const navItems: {
  icon: LucideIcon
  to: string
  label: string
}[] = [
  { icon: LayoutDashboard, to: '/instructor', label: 'Dashboard' },
  { icon: BookOpen, to: '/instructor/courses', label: 'My Courses' },
  {
    icon: ClipboardList,
    to: '/instructor/review-queue',
    label: 'Review Queue',
  },
  { icon: BookOpen, to: '/instructor/students', label: 'Students' },
  { icon: FileText, to: '/instructor/materials', label: 'Materials' },
  { icon: Bell, to: '/instructor/notifications', label: 'Notifications' },
  { icon: BarChart3, to: '/instructor/analytics', label: 'Analytics' },
]

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
  to,
}: {
  icon: LucideIcon
  isActive: boolean
  label: string
  to: string
}) {
  return (
    <Link
      to={to}
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
    </Link>
  )
}

function InstructorSidebar() {
  const location = useLocation()

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
          <SidebarNavItem
            key={item.to}
            icon={item.icon}
            isActive={
              item.to === '/instructor'
                ? location.pathname === '/instructor' ||
                  location.pathname === '/instructor/'
                : location.pathname.startsWith(item.to)
            }
            label={item.label}
            to={item.to}
          />
        ))}
      </nav>

      <div className="hidden border-t border-[#273241] px-3 py-4 md:block">
        <SidebarNavItem
          icon={Settings}
          isActive={location.pathname === '/instructor/settings'}
          label="Settings"
          to="/instructor/settings"
        />
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
        <span className="mr-2 size-4" aria-hidden>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-search"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          aria-label="Search course workspace"
          readOnly
          value=""
          placeholder="Search course, materials, or reviews..."
          className="h-8 w-full bg-transparent text-xs outline-none placeholder:text-[#74849a]"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-[6px] text-[#9ba9bc] transition-colors hover:bg-[#142033] hover:text-white"
          aria-label="Notifications"
        >
          <Bell className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-[6px] text-[#9ba9bc] transition-colors hover:bg-[#142033] hover:text-white"
          aria-label="Help"
        >
          <HelpCircle className="size-4" aria-hidden />
        </button>
        <div className="hidden text-right sm:block">
          <p className="max-w-40 truncate text-xs font-medium text-white">
            {displayName ?? 'Instructor'}
          </p>
          {email ? (
            <p className="max-w-40 truncate text-[0.68rem] text-[#7f8da3]">
              {email}
            </p>
          ) : null}
        </div>
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#a9c7ff] text-xs font-semibold text-[#07111f]"
          aria-hidden
        >
          {initials}
        </span>
      </div>
    </header>
  )
}

export function InstructorLayout() {
  const user = useAuthStore((state) => state.user)

  return (
    <main className="min-h-svh bg-[#050b12] text-[#d7dfec]">
      <div className="md:grid md:min-h-svh md:grid-cols-[13rem_minmax(0,1fr)]">
        <InstructorSidebar />

        <div className="min-w-0 bg-[#07111b]">
          <InstructorTopBar
            displayName={user?.displayName}
            email={user?.email}
          />

          <div className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6">
            <Outlet />
          </div>
        </div>
      </div>
    </main>
  )
}
