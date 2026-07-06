import { createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/login')({
  component: LoginPlaceholderPage,
  head: () => ({
    meta: [{ title: 'Log in — Morshid' }],
  }),
})

function LoginPlaceholderPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Log in</h1>
        <p className="text-sm text-muted-foreground">
          Authentication is not implemented yet. This route is reserved for the
          upcoming sign-in flow.
        </p>
        <Button nativeButton={false} render={<a href="/" />}>
          Back to home
        </Button>
      </div>
    </main>
  )
}
