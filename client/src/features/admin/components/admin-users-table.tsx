import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { AdminStatusBadge } from './admin-status-badge'
import { AdminUserActions } from './admin-user-actions'
import type { AdminManagedUser } from '@/features/admin/schemas/admin-managed-user.schema'

type AdminUsersTableProps = {
  users: AdminManagedUser[]
  isResettingPassword: boolean
  isUpdatingStatus: boolean
  onResetPassword: (userId: string, newPassword: string) => Promise<unknown>
  onStatusChange: (user: AdminManagedUser) => Promise<unknown>
}

const tableHeaders = [
  'User',
  'Role',
  'Course assignments',
  'Status',
  'Updated',
  'Actions',
] as const

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
})

export function AdminUsersTable({
  users,
  isResettingPassword,
  isUpdatingStatus,
  onResetPassword,
  onStatusChange,
}: AdminUsersTableProps) {
  return (
    <>
      {/* Mobile Card List (< md) */}
      <div className="divide-y divide-border border-t md:hidden">
        {users.map((user) => (
          <div
            key={user.id}
            className={cn(
              'flex items-center justify-between p-3.5 gap-3',
              user.status === 'DISABLED' ? 'bg-destructive/[0.04]' : 'hover:bg-secondary/20',
            )}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground truncate text-sm">
                  {user.displayName}
                </p>
                <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground shrink-0">
                  {toRoleLabel(user.role)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
                <AdminStatusBadge status={user.status} />
                <span>•</span>
                <span>{user.courseAssignments.courseCount} course(s)</span>
              </div>
            </div>

            <div className="shrink-0 flex items-center">
              <AdminUserActions
                user={user}
                isResettingPassword={isResettingPassword}
                isUpdatingStatus={isUpdatingStatus}
                onResetPassword={(newPassword) =>
                  onResetPassword(user.id, newPassword)
                }
                onStatusChange={() => onStatusChange(user)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table (>= md) */}
      <div className="hidden md:block max-h-[65vh] overflow-x-auto overflow-y-auto scrollbar-themed">
        <Table className="w-full min-w-[760px]">
          <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
            <TableRow>
              {tableHeaders.map((header) => (
                <TableHead
                  key={header}
                  className="smallcaps-label h-11 px-4 first:pl-6 last:pr-6"
                >
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.id}
                className={cn(
                  'h-[52px]',
                  user.status === 'DISABLED'
                    ? 'bg-destructive/[0.04] hover:bg-destructive/[0.07] [&_td:not(:nth-child(4))]:text-muted-foreground'
                    : 'hover:bg-secondary/40',
                )}
              >
                <TableCell className="px-4 py-3.5 first:pl-6">
                  <p className="font-medium text-foreground">
                    {user.displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  {toRoleLabel(user.role)}
                </TableCell>
                <TableCell className="px-4 py-3.5 tabular-nums">
                  {courseAssignmentText(user)}
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  <AdminStatusBadge status={user.status} />
                </TableCell>
                <TableCell className="px-4 py-3.5 text-muted-foreground tabular-nums">
                  {dateFormatter.format(new Date(user.updatedAt))}
                </TableCell>
                <TableCell className="px-4 py-3.5 last:pr-6">
                  <AdminUserActions
                    user={user}
                    isResettingPassword={isResettingPassword}
                    isUpdatingStatus={isUpdatingStatus}
                    onResetPassword={(newPassword) =>
                      onResetPassword(user.id, newPassword)
                    }
                    onStatusChange={() => onStatusChange(user)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}

function courseAssignmentText(user: AdminManagedUser) {
  return `${user.courseAssignments.courseCount}`
}

function toRoleLabel(role: AdminManagedUser['role']) {
  return `${role.slice(0, 1)}${role.slice(1).toLowerCase()}`
}
