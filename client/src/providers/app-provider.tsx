import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './theme-provider'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { getAppQueryClient } from '#/lib/query/query-client'
import { Navbar } from '#/components/layout/navbar'
import { Footer } from '#/components/layout/footer'
import { AuthRefreshSync } from '#/features/auth/components/auth-refresh-sync'

export function AppProviders() {
  const isInstructorRoute = useRouterState({
    select: (state) => state.location.pathname.startsWith('/instructor'),
  })

  return (
    <QueryClientProvider client={getAppQueryClient()}>
      <ThemeProvider defaultTheme="system" storageKey="theme">
        <AuthRefreshSync />
        {isInstructorRoute ? null : <Navbar />}
        <Outlet />
        {isInstructorRoute ? null : <Footer />}
      </ThemeProvider>
    </QueryClientProvider>
  )
}
