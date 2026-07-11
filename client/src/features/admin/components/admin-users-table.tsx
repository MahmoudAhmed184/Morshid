import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AdminStatusBadge } from './admin-status-badge'
import { AdminUserActions } from './admin-user-actions'
import type { AdminUser } from '../data/admin-ops.types'

type AdminUsersTableProps = {
  users: AdminUser[]
}

const tableHeaders = [
  'User',
  'Role',
  'Faculty',
  'Status',
  'Last Activity',
  'Actions',
] as const

export function AdminUsersTable({ users }: AdminUsersTableProps) {
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
          <TableRow key={user.id} className="border-border hover:bg-muted/40">
            <TableCell className="px-6 py-5">
              <p className="font-medium text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </TableCell>
            <TableCell className="px-6 py-5">{user.role}</TableCell>
            <TableCell className="px-6 py-5">{user.faculty}</TableCell>
            <TableCell className="px-6 py-5">
              <AdminStatusBadge status={user.status} />
            </TableCell>
            <TableCell className="px-6 py-5">{user.lastActivity}</TableCell>
            <TableCell className="px-6 py-5">
              <AdminUserActions user={user} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
