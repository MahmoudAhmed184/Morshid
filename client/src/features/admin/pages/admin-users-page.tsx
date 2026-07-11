import { useQuery } from '@tanstack/react-query'
import {
  BanIcon,
  KeyRoundIcon,
  PlusIcon,
  RotateCcwIcon,
  UserPlusIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import { DataTableState } from '@/components/ui/custom/data-table-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { adminUsersQueryOptions } from '../data/admin-ops.queries'
import type { AdminUser } from '../data/admin-ops.types'

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
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        Create User
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>
            Shell form for the P0 user creation API contract.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" placeholder="e.g., Sarah Al-Farsi" />
          <Field label="Email" placeholder="sarah@morshid.demo" />
          <Field label="Role" placeholder="Student, Instructor, Admin" />
          <Field label="Faculty" placeholder="Computer Science" />
        </div>
        <DialogFooter>
          <Button variant="outline">Save Draft</Button>
          <Button>
            <UserPlusIcon />
            Create User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UserActions({ user }: { user: AdminUser }) {
  const isDisabled = user.status === 'disabled'

  return (
    <div className="flex items-center gap-2">
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

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input placeholder={placeholder} />
    </div>
  )
}
