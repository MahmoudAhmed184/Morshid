import { useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { logoutApi } from '@/features/auth/api/auth.api'
import { useAuthStore } from '@/features/auth/stores/auth.store'

type RolePlaceholderPageProps = {
  roleName: string
}

export function RolePlaceholderPage({ roleName }: RolePlaceholderPageProps) {
  const navigate = useNavigate()
  const clearSession = useAuthStore((state) => state.clearSession)

  const handleLogout = async () => {
    const refreshToken = useAuthStore.getState().refreshToken

    try {
      if (refreshToken) {
        await logoutApi(refreshToken)
      }
    } catch {
      // Local logout must still complete if the revoke request is unavailable.
    } finally {
      clearSession()
      await navigate({ to: '/login' })
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-3xl font-semibold text-foreground">{roleName}</h1>
        <Button type="button" variant="outline" onClick={handleLogout}>
          <LogOut aria-hidden />
          Logout
        </Button>
      </div>
    </main>
  )
}
