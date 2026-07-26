import { Plus, Search } from 'lucide-react'

import { AppSidebar } from '@/components/layout/app-sidebar'
import { Button } from '@/components/ui/button'
import { useStudentChromeActions } from '@/features/student/components/student-chrome-context'
import {
  StudentSidebarContent,
  useStudentNewChat,
} from '@/features/student/components/student-sidebar-content'

function StudentCollapsedActions() {
  const { openSearchPalette } = useStudentChromeActions()
  const openNewChat = useStudentNewChat()

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

export function StudentAppSidebar() {
  return (
    <AppSidebar
      role="student"
      sidebarContent={<StudentSidebarContent />}
      collapsedActions={<StudentCollapsedActions />}
      showCollapsedActionsOnMobile
    />
  )
}
