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
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from '@/features/notifications/hooks/use-notifications'
import type { Notification } from '@/features/notifications/schemas/notification.schema'
import { resolveNotificationCourseId } from '@/features/notifications/utils/resolve-notification-course'
import { useStudentCourseContext } from '@/features/student/components/student-course-context'
import { getStudentReviewDetail } from '@/features/student/data/student-reviews.api'
import {
  getStudentSession,
  getStudentSessionMessages,
} from '@/features/student/data/student-sessions.api'

export function StudentNotificationBell() {
  const navigate = useNavigate()
  const { courses } = useStudentCourseContext()
  const unreadCountQuery = useUnreadNotificationCount()
  const notificationsQuery = useNotifications()
  const markReadMutation = useMarkNotificationRead()
  const selectionsInFlightRef = useRef(new Set<string>())
  const unreadCount = unreadCountQuery.data?.unreadCount ?? 0
  const hasUnreadNotifications = !unreadCountQuery.isError && unreadCount > 0
  const notifications =
    notificationsQuery.data?.pages.flatMap((page) => page.items) ?? []
  const accessibleLabel = hasUnreadNotifications
    ? `Notifications, ${unreadCount} unread`
    : 'Notifications'

  async function openNotification(notification: Notification) {
    if (selectionsInFlightRef.current.has(notification.id)) return
    selectionsInFlightRef.current.add(notification.id)

    try {
      if (notification.sessionId === null || notification.messageId === null) {
        if (notification.status === 'UNREAD') {
          await markReadMutation.mutateAsync(notification.id)
        }
        return
      }

      const courseId = await resolveNotificationCourseId({
        courses,
        sessionId: notification.sessionId,
      }).catch(() => null)
      if (courseId === null) return

      await Promise.all([
        getStudentSession({
          courseId,
          sessionId: notification.sessionId,
        }),
        getStudentSessionMessages({
          courseId,
          sessionId: notification.sessionId,
          input: { limit: 50, page: 'latest' },
        }),
        notification.reviewCaseId === null
          ? Promise.resolve()
          : getStudentReviewDetail({
              reviewCaseId: notification.reviewCaseId,
            }),
      ])

      await navigate({
        to: '/chat',
        search: { courseId, sessionId: notification.sessionId },
        hash: `message-${notification.messageId}`,
      })
      if (notification.status === 'UNREAD') {
        await markReadMutation.mutateAsync(notification.id).catch(() => null)
      }
    } catch {
      // Keep the notification unread when its destination cannot be shown.
    } finally {
      selectionsInFlightRef.current.delete(notification.id)
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
        {hasUnreadNotifications ? (
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
        aria-label="Notifications"
        className="w-[min(24rem,calc(100vw-1.5rem))] p-0"
      >
        <div className="px-4 py-3 text-sm font-semibold text-foreground">
          Notifications
        </div>
        <DropdownMenuSeparator className="m-0" />

        {notificationsQuery.isPending ? (
          <NotificationState
            icon={LoaderCircle}
            label="Loading notifications…"
          />
        ) : notificationsQuery.isError ? (
          <NotificationState
            icon={CircleAlert}
            label="Notifications could not be loaded."
          />
        ) : notifications.length === 0 ? (
          <NotificationState icon={Inbox} label="No notifications yet." />
        ) : (
          <div
            className="max-h-96 overflow-y-auto p-1"
            aria-label="Notification list"
          >
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                disabled={
                  markReadMutation.isPending &&
                  markReadMutation.variables === notification.id
                }
                onClick={() => void openNotification(notification)}
                className="items-start gap-3 px-3 py-3"
              >
                <span className="relative mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bell className="size-4" aria-hidden />
                  {notification.status === 'UNREAD' ? (
                    <>
                      <span
                        className="absolute top-0 right-0 size-2 rounded-full bg-info ring-2 ring-popover"
                        aria-hidden
                      />
                      <span className="sr-only">Unread notification. </span>
                    </>
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {notification.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    {notification.body}
                  </span>
                  <time
                    dateTime={notification.createdAt}
                    className="mt-1 block text-[0.68rem] text-muted-foreground"
                  >
                    {formatNotificationDate(notification.createdAt)}
                  </time>
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        )}

        {notificationsQuery.hasNextPage && !notificationsQuery.isError ? (
          <div className="border-t p-1">
            <DropdownMenuItem
              closeOnClick={false}
              className="justify-center"
              disabled={notificationsQuery.isFetchingNextPage}
              onClick={() => void notificationsQuery.fetchNextPage()}
            >
              {notificationsQuery.isFetchingNextPage ? (
                <LoaderCircle className="animate-spin" aria-hidden />
              ) : null}
              {notificationsQuery.isFetchingNextPage
                ? 'Loading more…'
                : 'Load more'}
            </DropdownMenuItem>
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NotificationState({
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

function formatNotificationDate(createdAt: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(createdAt))
}
