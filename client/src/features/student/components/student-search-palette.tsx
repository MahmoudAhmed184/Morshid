import { useNavigate, useRouterState } from '@tanstack/react-router'
import { MessageSquareText, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useStudentChromeActions,
  useStudentSearchPalette,
} from '@/features/student/components/student-chrome-context'
import { useStudentCourses } from '@/features/student/hooks/use-student-courses'
import { useStudentSessions } from '@/features/student/hooks/use-student-sessions'
import type { ChatSession } from '@/features/student/schemas/student-chat.schema'

/**
 * T15.8 — the student ⌘K search palette. A t3-style command dialog opened from
 * the collapsed cluster's search icon or Ctrl/Cmd+K anywhere in the student
 * shell. It offers a `New chat` action (draft + focus) and the active course's
 * already-loaded sessions filtered client-side (the same data the sidebar
 * list holds). Rendered once inside the student shell, so it is student-only.
 */
export function StudentSearchPalette() {
  const { isOpen, setOpen } = useStudentSearchPalette()
  const { requestComposerFocus } = useStudentChromeActions()
  const navigate = useNavigate()
  const search = useRouterState({ select: (state) => state.location.search })
  const routeCourseId = search.courseId
  const routeSessionId = search.sessionId

  const { data: assignedCourses } = useStudentCourses()
  const selectedCourse =
    (routeCourseId
      ? assignedCourses.find((course) => course.id === routeCourseId)
      : assignedCourses.length === 1
        ? assignedCourses[0]
        : undefined) ?? null

  const sessionsQuery = useStudentSessions({ courseId: selectedCourse?.id })
  const sessions =
    sessionsQuery.data?.pages.flatMap((page) => page.sessions) ?? []
  const [query, setQuery] = useState('')

  // Ctrl/Cmd+K opens the palette anywhere in the student shell.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen(true)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [setOpen])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const normalizedQuery = query.trim().toLowerCase()
  // Empty query shows the recent (already-loaded) sessions; a query filters them
  // client-side, the same list the sidebar renders.
  const filteredSessions =
    normalizedQuery.length === 0
      ? sessions
      : sessions.filter((session) =>
          session.title.toLowerCase().includes(normalizedQuery),
        )

  const handleNewChat = async () => {
    close()
    // T15.1/T15.7 — open the draft (skip the redundant navigation when already
    // there) and focus the composer.
    if (selectedCourse && routeSessionId !== undefined) {
      await navigate({
        to: '/chat',
        search: { courseId: selectedCourse.id },
      })
    }
    requestComposerFocus()
  }

  const handleSelectSession = async (session: ChatSession) => {
    close()
    if (!selectedCourse) {
      return
    }

    await navigate({
      to: '/chat',
      search: { courseId: selectedCourse.id, sessionId: session.id },
    })
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setQuery('')
        }
        setOpen(open)
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-1/4 translate-y-0 overflow-hidden rounded-2xl! p-0 sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Search your chats</DialogTitle>
        <DialogDescription className="sr-only">
          Search your conversations or start a new chat.
        </DialogDescription>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search your chats..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandGroup heading="Actions">
              <CommandItem
                value="new-chat"
                onSelect={() => void handleNewChat()}
              >
                <Plus aria-hidden />
                New chat
              </CommandItem>
            </CommandGroup>

            {filteredSessions.length > 0 ? (
              <CommandGroup heading="Chats">
                {filteredSessions.map((session) => (
                  <CommandItem
                    key={session.id}
                    value={session.id}
                    onSelect={() => void handleSelectSession(session)}
                  >
                    <MessageSquareText aria-hidden />
                    <span className="min-w-0 flex-1 truncate">
                      {session.title}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : normalizedQuery.length > 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No chats match your search.
              </p>
            ) : null}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
