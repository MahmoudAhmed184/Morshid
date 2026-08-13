import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import { useLogout } from '@/features/auth/session/use-logout'

export function SignOutButton() {
  const logout = useLogout()

  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          variant="outline"
          className="border-destructive/70 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut aria-hidden />
          Sign out
        </Button>
      }
      title="Sign out of Morshid?"
      description="You will need to sign back in to access your course materials and sessions."
      confirmLabel="Sign out"
      destructive
      onConfirm={logout}
    />
  )
}
