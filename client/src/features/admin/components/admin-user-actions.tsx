import { BanIcon, EyeIcon, RotateCcwIcon, UserRoundIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AdminManagedUser } from '@/features/admin/schemas/admin-managed-user.schema'
import { AdminStatusBadge } from './admin-status-badge'
import { ResetAdminUserPasswordDialog } from './reset-admin-user-password-dialog'

type AdminUserActionsProps = {
  user: AdminManagedUser
  isResettingPassword: boolean
  isUpdatingStatus: boolean
  onResetPassword: (newPassword: string) => Promise<unknown>
  onStatusChange: () => Promise<unknown>
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
})

export function AdminUserActions({
  user,
  isResettingPassword,
  isUpdatingStatus,
  onResetPassword,
  onStatusChange,
}: AdminUserActionsProps) {
  const isDisabled = user.status === 'DISABLED'
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setShowDetails(true)}
        aria-label="View user details"
        className="text-muted-foreground hover:text-foreground"
      >
        <EyeIcon className="size-4" />
      </Button>

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

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <UserRoundIcon className="size-5 text-primary" />
              User Profile Details
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3.5 py-1 text-sm">
            <div className="rounded-xl border bg-muted/40 p-3.5 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Full Name & Email
              </p>
              <p className="font-semibold text-foreground text-base">{user.displayName}</p>
              <p className="text-xs text-muted-foreground select-all">{user.email}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-card p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Role
                </p>
                <p className="font-semibold text-foreground capitalize">{user.role.toLowerCase()}</p>
              </div>

              <div className="rounded-xl border bg-card p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Status
                </p>
                <div>
                  <AdminStatusBadge status={user.status} />
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Course Assignments
              </p>
              <p className="font-medium text-foreground">
                Assigned to {user.courseAssignments.courseCount} course(s)
              </p>
              {user.courseAssignments.courses.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {user.courseAssignments.courses.map((course) => (
                    <span
                      key={course.id}
                      className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
                    >
                      {course.code} — {course.title}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border bg-card p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                User ID
              </p>
              <p className="font-mono text-xs text-foreground select-all break-all">{user.id}</p>
            </div>

            <div className="rounded-xl border bg-card p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Last Updated
              </p>
              <p className="font-medium text-foreground">{dateFormatter.format(new Date(user.updatedAt))}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
