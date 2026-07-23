import { useState } from 'react'
import { Link } from '@tanstack/react-router'

import type { ChatSession } from '@/features/student/schemas/student-chat.schema'
import { cn } from '@/lib/utils'

import { StudentSessionActionsMenu } from './student-session-actions-menu'
import { StudentSessionInlineRename } from './student-session-inline-rename'

interface StudentSessionListItemProps {
  courseId: string
  session: ChatSession
  isSelected: boolean
  areLifecycleMutationsPending: boolean
  isRenaming: boolean
  isDeleting: boolean
  onRename: (title: string) => Promise<void>
  onDelete: () => Promise<void>
  onNavigate?: () => void
}

export function StudentSessionListItem({
  courseId,
  session,
  isSelected,
  areLifecycleMutationsPending,
  isRenaming,
  isDeleting,
  onRename,
  onDelete,
  onNavigate,
}: StudentSessionListItemProps) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <li className="group relative rounded-lg [contain-intrinsic-size:auto_2.75rem] [content-visibility:auto]">
      {isEditing ? (
        <StudentSessionInlineRename
          session={session}
          isSelected={isSelected}
          isPending={isRenaming || areLifecycleMutationsPending}
          onCancel={() => setIsEditing(false)}
          onComplete={() => setIsEditing(false)}
          onRename={onRename}
        />
      ) : (
        <Link
          to="/student/ai-tutor"
          search={{ courseId, sessionId: session.id }}
          onClick={onNavigate}
          aria-current={isSelected ? 'page' : undefined}
          className={cn(
            'flex min-h-10 items-center rounded-lg py-2 pr-11 pl-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
            isSelected
              ? 'bg-muted text-foreground'
              : 'text-foreground hover:bg-muted/70',
          )}
        >
          <span className="block truncate font-normal">{session.title}</span>
        </Link>
      )}
      {!isEditing ? (
        <div
          className={cn(
            'absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center rounded-lg',
            isSelected
              ? 'bg-muted text-muted-foreground'
              : 'bg-transparent text-muted-foreground',
          )}
        >
          <StudentSessionActionsMenu
            session={session}
            isPending={areLifecycleMutationsPending}
            isDeleting={isDeleting}
            onStartRename={() => setIsEditing(true)}
            onDelete={onDelete}
          />
        </div>
      ) : null}
    </li>
  )
}
