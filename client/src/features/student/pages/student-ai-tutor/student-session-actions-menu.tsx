import { useState } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ChatSession } from '@/features/student/schemas/student-chat.schema'

import { StudentDeleteSessionDialog } from './student-delete-session-dialog'

interface StudentSessionActionsMenuProps {
  session: ChatSession
  isPending: boolean
  isDeleting: boolean
  onStartRename: () => void
  onDelete: () => Promise<void>
}

export function StudentSessionActionsMenu({
  session,
  isPending,
  isDeleting,
  onStartRename,
  onDelete,
}: StudentSessionActionsMenuProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isPending}
              aria-label={`Open actions for ${session.title}`}
            />
          }
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem disabled={isPending} onClick={onStartRename}>
            <Pencil aria-hidden />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isPending}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <StudentDeleteSessionDialog
        session={session}
        open={deleteOpen}
        isPending={isDeleting}
        onOpenChange={setDeleteOpen}
        onDelete={onDelete}
      />
    </>
  )
}
