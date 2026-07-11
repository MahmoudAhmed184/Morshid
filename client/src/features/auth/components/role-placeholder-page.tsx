import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useLogout } from '@/features/auth/hooks/use-logout'

type RolePlaceholderPageProps = {
  roleName: string
}

export function RolePlaceholderPage({ roleName }: RolePlaceholderPageProps) {
  const logout = useLogout()

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-3xl font-semibold text-foreground">{roleName}</h1>
        <Button type="button" variant="outline" onClick={logout}>
          <LogOut aria-hidden />
          Logout
        </Button>
      </div>
    </main>
  )
}
