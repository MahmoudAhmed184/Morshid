import { Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  AdminCourseMember,
  CourseMembershipRole,
} from '@/features/admin/schemas/admin-course.schema'

type AdminAssignmentsTableProps = {
  members: AdminCourseMember[]
  isPending: boolean
  onRoleChange: (userId: string, role: CourseMembershipRole) => void
  onRemove: (userId: string) => Promise<unknown>
}

const roleSelectItems = [
  { value: 'STUDENT' as const, label: 'Student' },
  { value: 'INSTRUCTOR' as const, label: 'Instructor' },
]

export function AdminAssignmentsTable({
  members,
  isPending,
  onRoleChange,
  onRemove,
}: AdminAssignmentsTableProps) {
  return (
    <Table className="min-w-[680px]">
      <TableHeader>
        <TableRow>
          <TableHead className="h-11 px-4 pl-6">User</TableHead>
          <TableHead className="h-11 px-4">Account role</TableHead>
          <TableHead className="h-11 px-4">Course role</TableHead>
          <TableHead className="h-11 px-4 pr-6 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell className="px-4 py-3.5 pl-6">
              <p className="font-medium text-foreground">
                {member.user.displayName}
              </p>
              <p className="text-xs text-muted-foreground">
                {member.user.email}
              </p>
            </TableCell>
            <TableCell className="px-4 py-3.5 capitalize">
              {member.user.role.toLowerCase()}
            </TableCell>
            <TableCell className="px-4 py-3.5">
              <Select
                value={member.role}
                disabled={isPending}
                items={roleSelectItems}
                onValueChange={(value) => {
                  if (value) {
                    onRoleChange(member.userId, value)
                  }
                }}
              >
                <SelectTrigger
                  aria-label={`Course role for ${member.user.displayName}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleSelectItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell className="px-4 py-3.5 pr-6 text-right">
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon-sm" disabled={isPending}>
                    <Trash2Icon />
                    <span className="sr-only">Remove assignment</span>
                  </Button>
                }
                title="Remove course assignment?"
                description={`${member.user.displayName} will lose access to this course.`}
                confirmLabel="Remove"
                disabled={isPending}
                onConfirm={async () => {
                  await onRemove(member.userId)
                }}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
