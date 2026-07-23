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
    <li className="group relative rounded-lg [contain-intrinsic-size:auto_2.25rem] [content-visibility:auto]">
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
          to="/chat"
          search={{ courseId, sessionId: session.id }}
          onClick={onNavigate}
          aria-current={isSelected ? 'page' : undefined}
          className={cn(
            'relative flex h-9 items-center rounded-lg pr-8 pl-3 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
            isSelected
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
          )}
        >
          <span
            className={cn(
              'absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-rubric transition-opacity',
              isSelected ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden
          />
          <span className="block truncate">{session.title}</span>
        </Link>
      )}
      {!isEditing ? (
        <div
          className={cn(
            'absolute top-1/2 right-1 flex -translate-y-1/2 items-center rounded-md opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100',
            isSelected && 'opacity-100',
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
