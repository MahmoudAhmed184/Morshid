import { Menu } from 'lucide-react'
import { useState } from 'react'

import { DashboardHeader } from '@/components/layout/dashboard-header'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import type { StudentCourse } from '@/features/student/api/student-courses.api'
import { StudentSidebar } from '@/features/student/components/student-sidebar'

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

  return (
    <DashboardHeader
      displayName={user?.displayName}
      email={user?.email}
      searchLabel="Search student workspace"
      searchPlaceholder="Search courses or learning resources..."
      leading={
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
      }
    />
  )
}
