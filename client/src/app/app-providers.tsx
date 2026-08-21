import { QueryClientProvider } from '@tanstack/react-query'
import { Outlet } from '@tanstack/react-router'

import type { QueryClient } from '@tanstack/react-query'
import { AuthRefreshSync } from '@/features/auth/session/auth-refresh-sync'
import { useAuthStore } from '@/features/auth/session/interface/session-store'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { NavigationScrollReset } from '@/app/navigation-scroll-reset'

export function AppProviders({ queryClient }: { queryClient: QueryClient }) {
  const userId = useAuthStore((state) => state.user?.id)

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        defaultTheme="light"
        defaultPalette="morshid"
        storageKey="theme"
        userId={userId}
      >
        <AuthRefreshSync />
        <NavigationScrollReset />
        <Outlet />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
