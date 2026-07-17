import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useLogout } from '@/features/auth/hooks/use-logout'

export function SignOutButton() {
  const logout = useLogout()

  return (
    <Button type="button" variant="outline" onClick={logout}>
      <LogOut aria-hidden />
      Sign out
    </Button>
  )
}
