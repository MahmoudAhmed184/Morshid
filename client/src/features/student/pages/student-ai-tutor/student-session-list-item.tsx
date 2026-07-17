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
  isRenaming: boolean
  isDeleting: boolean
  onRename: (title: string) => Promise<void>
  onDelete: () => Promise<void>
  onNavigate?: () => void
}

const sessionActivityFormatter = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export function StudentSessionListItem({
  courseId,
  session,
  isSelected,
  isRenaming,
  isDeleting,
  onRename,
  onDelete,
  onNavigate,
}: StudentSessionListItemProps) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <li className="group relative rounded-xl [contain-intrinsic-size:auto_4rem] [content-visibility:auto]">
      {isEditing ? (
        <StudentSessionInlineRename
          session={session}
          isSelected={isSelected}
          isPending={isRenaming}
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
            'flex min-h-16 flex-col justify-center rounded-xl py-2.5 pr-12 pl-3.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:outline-none',
            isSelected
              ? 'bg-blue-50 text-slate-950'
              : 'text-slate-800 hover:bg-slate-50',
          )}
        >
          <span className="block truncate font-medium">{session.title}</span>
          <span
            className={cn(
              'mt-1 block text-xs',
              isSelected ? 'text-blue-600' : 'text-muted-foreground',
            )}
          >
            {session.lastMessageAt ? (
              <time dateTime={session.lastMessageAt}>
                Last active{' '}
                {sessionActivityFormatter.format(
                  new Date(session.lastMessageAt),
                )}
              </time>
            ) : (
              'No messages yet'
            )}
          </span>
        </Link>
      )}
      {!isEditing ? (
        <div
          className={cn(
            'absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center rounded-lg',
            isSelected
              ? 'bg-blue-50 text-slate-600'
              : 'bg-white/90 text-slate-500',
          )}
        >
          <StudentSessionActionsMenu
            session={session}
            isPending={isRenaming || isDeleting}
            isDeleting={isDeleting}
            onStartRename={() => setIsEditing(true)}
            onDelete={onDelete}
          />
        </div>
      ) : null}
    </li>
  )
}
