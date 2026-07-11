import { BanIcon, KeyRoundIcon, RotateCcwIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import { UpdateAdminUserDialog } from './update-admin-user-dialog'
import type { AdminUser } from '../data/admin-ops.types'
import type { EditableAdminUser } from './update-admin-user-dialog'

export function AdminUserActions({ user }: { user: AdminUser }) {
  const isDisabled = user.status === 'disabled'

  return (
    <div className="flex items-center gap-2">
      {isEditableUser(user) ? <UpdateAdminUserDialog user={user} /> : null}
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

function isEditableUser(user: AdminUser): user is EditableAdminUser {
  return user.role === 'Student' || user.role === 'Instructor'
}
