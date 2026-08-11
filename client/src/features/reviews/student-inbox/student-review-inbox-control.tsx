import { useNavigate } from '@tanstack/react-router'
import { Bell, CircleAlert, Inbox, LoaderCircle } from 'lucide-react'
import { useRef } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useMarkStudentReviewInboxItemRead,
  useStudentReviewInbox,
  useUnreadStudentReviewInboxCount,
} from './use-student-review-inbox'
import type { StudentReviewInboxItem } from './student-review-inbox.schema'

export function StudentReviewInboxControl() {
  const navigate = useNavigate()
  const unreadCountQuery = useUnreadStudentReviewInboxCount()
  const inboxQuery = useStudentReviewInbox()
  const markReadMutation = useMarkStudentReviewInboxItemRead()
  const selectionsInFlightRef = useRef(new Set<string>())
  const unreadCount = unreadCountQuery.data?.unreadCount ?? 0
  const hasUnreadItems = !unreadCountQuery.isError && unreadCount > 0
  const items = inboxQuery.data?.pages.flatMap((page) => page.items) ?? []
  const accessibleLabel = hasUnreadItems
    ? `Review inbox, ${unreadCount} unread`
    : 'Review inbox'

  async function openItem(item: StudentReviewInboxItem) {
    if (selectionsInFlightRef.current.has(item.id)) return
    selectionsInFlightRef.current.add(item.id)

    try {
      await navigate({
        to: '/chat',
        search: { courseId: item.courseId, sessionId: item.sessionId },
        hash: `message-${item.messageId}`,
      })
      if (item.status === 'UNREAD') {
        await markReadMutation.mutateAsync(item.id).catch(() => null)
      }
    } catch {
      // Keep the item unread when the destination cannot be shown.
    } finally {
      selectionsInFlightRef.current.delete(item.id)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={accessibleLabel}
            className="relative"
          />
        }
      >
        <Bell
          className="size-4 text-muted-foreground"
          strokeWidth={1.75}
          aria-hidden
        />
        {hasUnreadItems ? (
          <Badge
            variant="destructive"
            aria-hidden
            className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[0.625rem] leading-none shadow-xs"
          >
            {unreadCount}
          </Badge>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        aria-label="Review inbox"
        className="w-[min(24rem,calc(100vw-1.5rem))] p-0"
      >
        <div className="px-4 py-3 text-sm font-semibold text-foreground">
          Review inbox
        </div>
        <DropdownMenuSeparator className="m-0" />

        {inboxQuery.isPending ? (
          <InboxState icon={LoaderCircle} label="Loading review inbox…" />
        ) : inboxQuery.isError ? (
          <InboxState
            icon={CircleAlert}
            label="Review inbox could not be loaded."
          />
        ) : items.length === 0 ? (
          <InboxState icon={Inbox} label="No review updates yet." />
        ) : (
          <div
            className="max-h-96 overflow-y-auto p-1"
            aria-label="Review inbox list"
          >
            {items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                disabled={
                  markReadMutation.isPending &&
                  markReadMutation.variables === item.id
                }
                onClick={() => void openItem(item)}
                className="items-start gap-3 px-3 py-3"
              >
                <span className="relative mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bell className="size-4" aria-hidden />
                  {item.status === 'UNREAD' ? (
                    <>
                      <span
                        className="absolute top-0 right-0 size-2 rounded-full bg-info ring-2 ring-popover"
                        aria-hidden
                      />
                      <span className="sr-only">Unread review update. </span>
                    </>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    {item.body}
                  </span>
                  <time
                    dateTime={item.createdAt}
                    className="mt-1 block text-[0.68rem] text-muted-foreground"
                  >
                    {formatReviewInboxDate(item.createdAt)}
                  </time>
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}

        {inboxQuery.hasNextPage && !inboxQuery.isError ? (
          <div className="border-t p-1">
            <DropdownMenuItem
              closeOnClick={false}
              className="justify-center"
              disabled={inboxQuery.isFetchingNextPage}
              onClick={() => void inboxQuery.fetchNextPage()}
            >
              {inboxQuery.isFetchingNextPage ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : null}
              {inboxQuery.isFetchingNextPage ? 'Loading more…' : 'Load more'}
            </DropdownMenuItem>
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function InboxState({
  icon: Icon,
  label,
}: {
  icon: typeof Inbox
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-8 text-center text-sm text-muted-foreground">
      <Icon
        className={Icon === LoaderCircle ? 'size-5 animate-spin' : 'size-5'}
        aria-hidden
      />
      <p>{label}</p>
    </div>
  )
}

function formatReviewInboxDate(createdAt: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(createdAt))
}
