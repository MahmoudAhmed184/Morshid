import { BanIcon, RotateCcwIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import type { AdminManagedUser } from '@/features/admin/schemas/admin-managed-user.schema'
import { ResetAdminUserPasswordDialog } from './reset-admin-user-password-dialog'

type AdminUserActionsProps = {
  user: AdminManagedUser
  isResettingPassword: boolean
  isUpdatingStatus: boolean
  onResetPassword: (newPassword: string) => Promise<unknown>
  onStatusChange: () => Promise<unknown>
}

export function AdminUserActions({
  user,
  isResettingPassword,
  isUpdatingStatus,
  onResetPassword,
  onStatusChange,
}: AdminUserActionsProps) {
  const isDisabled = user.status === 'DISABLED'

  return (
    <div className="flex items-center gap-2">
      <ResetAdminUserPasswordDialog
        user={user}
        isPending={isResettingPassword}
        onResetPassword={onResetPassword}
      />
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="icon-sm" disabled={isUpdatingStatus}>
            {isDisabled ? <RotateCcwIcon /> : <BanIcon />}
            <span className="sr-only">
              {isDisabled ? 'Reactivate user' : 'Disable user'}
            </span>
          </Button>
        }
        title={isDisabled ? 'Reactivate user' : 'Disable user'}
        description={
          isDisabled
            ? `${user.displayName} will regain access after the API confirms this action.`
            : `${user.displayName} will lose access after the API confirms this action.`
        }
        confirmLabel={isDisabled ? 'Reactivate' : 'Disable'}
        destructive={!isDisabled}
        disabled={isUpdatingStatus}
        onConfirm={async () => {
          await onStatusChange()
        }}
      />
    </div>
  )
}
