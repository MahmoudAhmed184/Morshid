import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './theme-provider'
import { Outlet } from '@tanstack/react-router'
import { getAppQueryClient } from '#/lib/query/query-client'
import { Navbar } from '#/components/layout/navbar'
import { Footer } from '#/components/layout/footer'

export function AppProviders() {
  return (
    <QueryClientProvider client={getAppQueryClient()}>
      <ThemeProvider defaultTheme="system" storageKey="theme">
        <Navbar />
        <Outlet />
        <Footer />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
