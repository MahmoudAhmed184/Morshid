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
    <Table className="min-w-[760px]">
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          {tableHeaders.map((header) => (
            <TableHead
              key={header}
              className="h-14 px-6 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase"
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
              'border-border hover:bg-muted/40',
              user.status === 'DISABLED' &&
                'bg-destructive/5 text-muted-foreground hover:bg-destructive/10',
            )}
          >
            <TableCell className="px-6 py-5">
              <p className="font-medium text-foreground">{user.displayName}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </TableCell>
            <TableCell className="px-6 py-5">
              {toRoleLabel(user.role)}
            </TableCell>
            <TableCell className="px-6 py-5">
              {user.courseAssignments.courseCount}
            </TableCell>
            <TableCell className="px-6 py-5">
              <AdminStatusBadge status={user.status} />
            </TableCell>
            <TableCell className="px-6 py-5">
              {dateFormatter.format(new Date(user.updatedAt))}
            </TableCell>
            <TableCell className="px-6 py-5">
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
  )
}

function toRoleLabel(role: AdminManagedUser['role']) {
  return `${role.slice(0, 1)}${role.slice(1).toLowerCase()}`
}
