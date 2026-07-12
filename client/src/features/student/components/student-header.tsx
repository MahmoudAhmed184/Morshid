import { LogOut, Menu, Search } from 'lucide-react'
import { useState } from 'react'

import { Logo } from '@/components/logo'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useLogout } from '@/features/auth/hooks/use-logout'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { StudentCourse } from '@/features/student/api/student-courses.api'
import { StudentSidebar } from '@/features/student/components/student-sidebar'

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

type StudentHeaderProps = {
  assignedCourses: StudentCourse[]
  pathname: string
}

export function StudentHeader({
  assignedCourses,
  pathname,
}: StudentHeaderProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const user = useAuthStore((state) => state.user)
  const logout = useLogout()
  const displayName = user?.displayName ?? 'Student'
  const initials = getInitials(displayName)

  return (
    <header className="flex min-h-16 items-center gap-3 border-b border-border px-4 sm:px-6">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              className="bg-transparent md:hidden"
              aria-label="Open student navigation"
            />
          }
        >
          <Menu className="size-5" aria-hidden />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-72 max-w-[85vw] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-xs"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Student navigation</SheetTitle>
          </SheetHeader>
          <StudentSidebar
            assignedCourses={assignedCourses}
            pathname={pathname}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="md:hidden">
        <Logo
          className="size-8 rounded-md bg-primary text-primary-foreground"
          iconClassName="size-4"
        />
      </div>

      <div className="relative hidden min-w-0 flex-1 sm:block">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="Search"
          placeholder="Search"
          className="h-9 bg-background pl-9"
        />
      </div>

      <Badge variant="secondary" className="hidden sm:inline-flex">
        Student
      </Badge>

      <Avatar className="bg-muted text-foreground" aria-label={displayName}>
        <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>

      <Button
        type="button"
        variant="outline"
        onClick={logout}
        className="bg-transparent"
      >
        <LogOut className="size-4" aria-hidden />
        Log out
      </Button>
    </header>
  )
}
