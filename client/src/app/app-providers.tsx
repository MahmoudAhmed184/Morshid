import { QueryClientProvider } from '@tanstack/react-query'
import { Outlet } from '@tanstack/react-router'

import type { QueryClient } from '@tanstack/react-query'
import { AuthRefreshSync } from '@/features/auth/session/auth-refresh-sync'
import { ThemeProvider } from '@/components/theme/theme-provider'

export function AppProviders({ queryClient }: { queryClient: QueryClient }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="theme">
        <AuthRefreshSync />
        <Outlet />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
