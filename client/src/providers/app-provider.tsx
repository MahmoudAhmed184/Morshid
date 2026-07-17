import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './theme-provider'
import { Outlet } from '@tanstack/react-router'
import { getAppQueryClient } from '#/lib/query/query-client'
import { AuthRefreshSync } from '#/features/auth/components/auth-refresh-sync'

export function AppProviders() {
  return (
    <QueryClientProvider client={getAppQueryClient()}>
      <ThemeProvider defaultTheme="system" storageKey="theme">
        <AuthRefreshSync />
        <Outlet />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
