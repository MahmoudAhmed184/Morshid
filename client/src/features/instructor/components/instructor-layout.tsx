import { Outlet, Link, useLocation } from '@tanstack/react-router'
import {
  BarChart3,
  Bell,
  BookOpen,
  ClipboardList,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Menu,
  Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
  onClick,
  to,
}: {
  icon: LucideIcon
  isActive: boolean
  label: string
  onClick?: () => void
  to: string
}) {
  return (
    <Link
      to={to}
      aria-current={isActive ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex h-9 w-full items-center gap-2 rounded-[6px] border-l-2 border-transparent px-3 text-left text-xs font-medium transition-colors',
        isActive
          ? 'border-primary bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </Link>
  )
}

function InstructorSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()

  return (
    <aside className="flex flex-col bg-card text-card-foreground md:min-h-svh md:w-52 md:border-r md:border-border">
      <div className="flex min-h-16 items-center gap-3 border-b border-border px-4 md:min-h-20">
        <Logo
          className="size-8 rounded-[6px] bg-primary text-primary-foreground"
          iconClassName="size-4"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Morshid</p>
          <p className="truncate text-[0.68rem] text-muted-foreground">
            Instructor Portal
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
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
            onClick={onNavigate}
          />
        ))}
      </nav>

      <div className="border-t border-border px-3 py-4">
        <SidebarNavItem
          icon={Settings}
          isActive={location.pathname === '/instructor/settings'}
          label="Settings"
          to="/instructor/settings"
          onClick={onNavigate}
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
    <header className="flex min-h-16 items-center gap-4 border-b border-border bg-card px-4 md:px-6">
      <div className="hidden min-w-0 flex-1 items-center rounded-[6px] border border-border bg-background px-3 text-muted-foreground md:flex">
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
          className="h-8 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-[6px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Help"
        >
          <HelpCircle className="size-4" aria-hidden />
        </button>
        <div className="hidden text-right sm:block">
          <p className="max-w-40 truncate text-xs font-medium text-foreground">
            {displayName ?? 'Instructor'}
          </p>
          {email ? (
            <p className="max-w-40 truncate text-[0.68rem] text-muted-foreground">
              {email}
            </p>
          ) : null}
        </div>
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="md:grid md:min-h-svh md:grid-cols-[13rem_minmax(0,1fr)]">
        {/* Mobile sidebar */}
        <div className="md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="fixed left-4 top-4 z-40 md:hidden"
            aria-label="Open menu"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="size-5" aria-hidden />
          </Button>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="border-b border-border px-4 py-3">
                <SheetTitle className="text-sm font-semibold text-foreground">
                  Menu
                </SheetTitle>
              </SheetHeader>
              <InstructorSidebar onNavigate={() => setMobileMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <InstructorSidebar />
        </div>

        <div className="min-w-0 bg-background">
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
