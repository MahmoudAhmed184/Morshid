import { Plus, Search } from 'lucide-react'

import { AuthenticatedSidebar } from '@/workspaces/_shared/authenticated-sidebar/authenticated-sidebar'
import { Button } from '@/components/ui/button'
import { useStudentChromeActions } from '@/workspaces/student/navigation/student-chrome-context'
import { useStudentCourseContext } from '@/workspaces/student/navigation/student-course-context'
import {
  StudentSidebarContent,
  useStudentNewChat,
} from '@/workspaces/student/navigation/student-sidebar-content'

function StudentCollapsedActions() {
  const { openSearchPalette } = useStudentChromeActions()
  const openNewChat = useStudentNewChat()
  const { courses: assignedCourses } = useStudentCourseContext()

  if (assignedCourses.length === 0) {
    return null
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Search your chats"
        onClick={() => openSearchPalette()}
      >
        <Search aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="New chat"
        onClick={() => void openNewChat()}
      >
        <Plus aria-hidden />
      </Button>
    </>
  )
}

export function StudentSidebar() {
  return (
    <AuthenticatedSidebar
      role="student"
      sidebarContent={<StudentSidebarContent />}
      collapsedActions={<StudentCollapsedActions />}
      showCollapsedActionsOnMobile
    />
  )
}
