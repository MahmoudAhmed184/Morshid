import { useRouter } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function RouteLoadError() {
  const router = useRouter()

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
        <TriangleAlert className="mx-auto size-10 text-amber-500" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold text-foreground">
          Unable to load this page
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Morshid could not reach a required service. No local data was changed.
        </p>
        <Button
          type="button"
          className="mt-5"
          onClick={() => void router.invalidate()}
        >
          Try again
        </Button>
      </section>
    </main>
  )
}
