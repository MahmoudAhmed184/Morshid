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
    <div className="max-h-[65vh] overflow-auto scrollbar-themed">
      <Table className="min-w-[760px]">
        <TableHeader className="sticky top-0 z-10 bg-secondary/40">
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
                {user.courseAssignments.courseCount}
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
  )
}

function toRoleLabel(role: AdminManagedUser['role']) {
  return `${role.slice(0, 1)}${role.slice(1).toLowerCase()}`
}
