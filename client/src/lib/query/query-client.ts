import { QueryClient } from '@tanstack/react-query'

let browserQueryClient: QueryClient | undefined

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 15_000,
      },
    },
  })
}

export function getAppQueryClient() {
  if (typeof window === 'undefined') {
    return createAppQueryClient()
  }

  browserQueryClient ??= createAppQueryClient()
  return browserQueryClient
}
