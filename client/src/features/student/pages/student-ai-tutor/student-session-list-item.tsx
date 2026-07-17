import { Link } from '@tanstack/react-router'

import type { ChatSession } from '@/features/student/schemas/student-chat.schema'
import { cn } from '@/lib/utils'

import { StudentDeleteSessionDialog } from './student-delete-session-dialog'
import { StudentRenameSessionDialog } from './student-rename-session-dialog'

interface StudentSessionListItemProps {
  courseId: string
  session: ChatSession
  isSelected: boolean
  isRenaming: boolean
  isDeleting: boolean
  onRename: (title: string) => Promise<void>
  onDelete: () => Promise<void>
}

export function StudentSessionListItem({
  courseId,
  session,
  isSelected,
  isRenaming,
  isDeleting,
  onRename,
  onDelete,
}: StudentSessionListItemProps) {
  return (
    <li className="group relative rounded-md">
      <Link
        to="/student/ai-tutor"
        search={{ courseId, sessionId: session.id }}
        aria-current={isSelected ? 'page' : undefined}
        className={cn(
          'block rounded-md py-2.5 pr-16 pl-3 text-sm transition-colors',
          isSelected
            ? 'bg-primary text-primary-foreground'
            : 'text-foreground hover:bg-muted',
        )}
      >
        <span className="block truncate font-medium">{session.title}</span>
        <span
          className={cn(
            'mt-1 block text-xs',
            isSelected ? 'text-primary-foreground/75' : 'text-muted-foreground',
          )}
        >
          {session.lastMessageAt
            ? 'Conversation history saved'
            : 'No messages yet'}
        </span>
      </Link>
      <div
        className={cn(
          'absolute top-1/2 right-1 flex -translate-y-1/2 items-center rounded-md',
          isSelected
            ? 'bg-primary text-primary-foreground'
            : 'bg-background/90',
        )}
      >
        <StudentRenameSessionDialog
          session={session}
          isPending={isRenaming}
          onRename={onRename}
        />
        <StudentDeleteSessionDialog
          session={session}
          isPending={isDeleting}
          onDelete={onDelete}
        />
      </div>
    </li>
  )
}
