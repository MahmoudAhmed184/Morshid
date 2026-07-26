import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/custom/confirm-dialog'
import { useLogout } from '@/features/auth/hooks/use-logout'

export function SignOutButton() {
  const logout = useLogout()

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="outline">
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
