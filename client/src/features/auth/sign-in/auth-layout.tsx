import { ModeToggle } from '@/components/ui/mode-toggle'
import { cn } from '@/lib/utils'

type AuthLayoutProps = {
  children: React.ReactNode
  className?: string
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-x-hidden overflow-y-auto bg-background px-3 pt-16 pb-4 text-foreground sm:px-6 sm:py-4 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-90 saturate-[0.88] dark:opacity-45 dark:brightness-[0.55] dark:saturate-[0.72]"
        style={{ backgroundImage: "url('/login-bg.jpg')" }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--card)_78%,transparent)_0%,color-mix(in_oklab,var(--background)_42%,transparent)_48%,var(--background)_100%)]"
      />

      <div className="fixed top-3 right-3 z-20 rounded-full border border-border/70 bg-card/80 text-card-foreground shadow-md backdrop-blur-md sm:top-6 sm:right-6">
        <ModeToggle />
      </div>

      <div
        className={cn('relative z-10 my-auto w-full max-w-[540px]', className)}
      >
        {children}
      </div>
    </div>
  )
}
