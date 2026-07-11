import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './theme-provider'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { getAppQueryClient } from '#/lib/query/query-client'
import { Footer } from '#/components/layout/footer'
import { Navbar } from '#/components/layout/navbar'
import { AuthRefreshSync } from '#/features/auth/components/auth-refresh-sync'

export function AppProviders() {
  const isAdminRoute = useRouterState({
    select: (state) => state.location.pathname.startsWith('/admin'),
  })

  return (
    <QueryClientProvider client={getAppQueryClient()}>
      <ThemeProvider defaultTheme="system" storageKey="theme">
        <AuthRefreshSync />
        {isAdminRoute ? null : <Navbar />}
        <Outlet />
        {isAdminRoute ? null : <Footer />}
      </ThemeProvider>
    </QueryClientProvider>
  )
}
