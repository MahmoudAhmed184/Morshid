import { useQuery } from '@tanstack/react-query'
import {
  BanIcon,
  KeyRoundIcon,
  PencilIcon,
  RotateCcwIcon,
  UserPlusIcon,
} from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import { DataTableState } from '@/components/ui/custom/data-table-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AdminPanel } from '../components/admin-panel'
import { PageHeader } from '@/components/ui/custom/page-header'
import { AdminStatusBadge } from '../components/admin-status-badge'
import { AdminUserForm } from '../components/admin-user-form'
import { adminUsersQueryOptions } from '../data/admin-ops.queries'
import type { AdminUser } from '../data/admin-ops.types'
import type { AdminUserFormValues } from '../schemas/admin-user.schema'

export function AdminUsersPage() {
  const usersQuery = useQuery(adminUsersQueryOptions())

  return (
    <div>
      <PageHeader
        className="mb-8"
        eyebrow="Identity Operations"
        title="User Management"
        description="Create users, review core identity fields, disable or reactivate accounts, and reset passwords."
        actions={<CreateUserDialog />}
      />

      <AdminPanel>
        <DataTableState
          isLoading={usersQuery.isPending}
          isError={usersQuery.isError}
          isEmpty={usersQuery.data?.length === 0}
          onRetry={() => void usersQuery.refetch()}
          isRetrying={usersQuery.isFetching}
          emptyTitle="No users found"
          emptyDescription="Users returned by the API will appear in this table."
        >
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="h-14 px-6 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  User
                </TableHead>
                <TableHead className="h-14 px-6 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Role
                </TableHead>
                <TableHead className="h-14 px-6 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Faculty
                </TableHead>
                <TableHead className="h-14 px-6 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Status
                </TableHead>
                <TableHead className="h-14 px-6 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Last Activity
                </TableHead>
                <TableHead className="h-14 px-6 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.data?.map((user) => (
                <TableRow
                  key={user.id}
                  className="border-border hover:bg-muted/40"
                >
                  <TableCell className="px-6 py-5">
                    <p className="font-medium text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                    </p>
                  </TableCell>
                  <TableCell className="px-6 py-5">{user.role}</TableCell>
                  <TableCell className="px-6 py-5">{user.faculty}</TableCell>
                  <TableCell className="px-6 py-5">
                    <AdminStatusBadge status={user.status} />
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    {user.lastActivity}
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <UserActions user={user} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTableState>
      </AdminPanel>
    </div>
  )
}

function CreateUserDialog() {
  const [open, setOpen] = useState(false)

  const handleSubmit = async (values: AdminUserFormValues) => {
    await submitAdminUserForm(values)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <UserPlusIcon />
        Create User
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>
            Shell form for the P0 user creation API contract.
          </DialogDescription>
        </DialogHeader>
        <AdminUserForm
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function UserActions({ user }: { user: AdminUser }) {
  const isDisabled = user.status === 'disabled'

  return (
    <div className="flex items-center gap-2">
      {isEditableUser(user) ? <UpdateUserDialog user={user} /> : null}
      <ResetPasswordDialog user={user} />
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="icon-sm">
            {isDisabled ? <RotateCcwIcon /> : <BanIcon />}
            <span className="sr-only">
              {isDisabled ? 'Reactivate user' : 'Disable user'}
            </span>
          </Button>
        }
        title={isDisabled ? 'Reactivate user' : 'Disable user'}
        description={
          isDisabled
            ? `${user.name} will regain access after the API confirms this action.`
            : `${user.name} will lose access after the API confirms this action.`
        }
        confirmLabel={isDisabled ? 'Reactivate' : 'Disable'}
        destructive={!isDisabled}
        onConfirm={() => undefined}
      />
    </div>
  )
}

function UpdateUserDialog({
  user,
}: {
  user: AdminUser & { role: 'Student' | 'Instructor' }
}) {
  const [open, setOpen] = useState(false)

  const handleSubmit = async (values: AdminUserFormValues) => {
    await submitAdminUserForm(values)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <PencilIcon />
        <span className="sr-only">Update user</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Update User</DialogTitle>
          <DialogDescription>
            Update profile and role fields before wiring the user API.
          </DialogDescription>
        </DialogHeader>
        <AdminUserForm
          user={user}
          onSubmit={handleSubmit}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function ResetPasswordDialog({ user }: { user: AdminUser }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-sm">
          <KeyRoundIcon />
          <span className="sr-only">Reset password</span>
        </Button>
      }
      title="Reset password"
      description={`Generate a temporary password reset for ${user.email}.`}
      confirmLabel="Reset Password"
      destructive={false}
      onConfirm={() => undefined}
    />
  )
}

function isEditableUser(
  user: AdminUser,
): user is AdminUser & { role: 'Student' | 'Instructor' } {
  return user.role === 'Student' || user.role === 'Instructor'
}

async function submitAdminUserForm(_values: AdminUserFormValues) {
  await new Promise((resolve) => window.setTimeout(resolve, 600))
}
