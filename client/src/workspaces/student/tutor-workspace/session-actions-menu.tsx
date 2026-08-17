import { useState } from 'react'
import { Download, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ChatSession } from '@/features/chat/sessions/chat-session.schema'

import { StudentDeleteSessionDialog } from './delete-session-dialog'

interface StudentSessionActionsMenuProps {
  session: ChatSession
  isPending: boolean
  isDeleting: boolean
  isExporting?: boolean
  onStartRename: () => void
  onDelete: () => Promise<void>
  onExport?: () => Promise<void>
}

export function StudentSessionActionsMenu({
  session,
  isPending,
  isDeleting,
  isExporting = false,
  onStartRename,
  onDelete,
  onExport,
}: StudentSessionActionsMenuProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const isBusy = isPending || isDeleting || isExporting

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isBusy}
              aria-label={`Open actions for ${session.title}`}
            />
          }
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem disabled={isBusy} onClick={onStartRename}>
            <Pencil aria-hidden />
            Rename
          </DropdownMenuItem>
          {onExport ? (
            <DropdownMenuItem disabled={isBusy} onClick={() => void onExport()}>
              <Download aria-hidden />
              Export as Markdown
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            disabled={isBusy}
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
