import { Link } from '@tanstack/react-router'
import { ArrowLeft, Home } from 'lucide-react'

import { Logo } from '@/components/branding/logo'
import { ModeToggle } from '@/components/ui/mode-toggle'
import { Button, buttonVariants } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-border/60 px-6 sm:px-10">
        <Link
          to="/"
          className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
        >
          <Logo iconClassName="size-5" />
          <span>Morshid</span>
        </Link>
        <ModeToggle />
      </header>

      {/* Main minimal 404 */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="font-mono text-8xl font-bold tracking-tighter text-muted-foreground/30 sm:text-9xl">
          404
        </span>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Page not found
        </h1>

        <p className="mt-3 max-w-sm text-sm text-muted-foreground sm:text-base">
          The page you are looking for doesn't exist or has been moved.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <Link
            to="/"
            className={buttonVariants({ size: 'lg', className: 'gap-2' })}
          >
            <Home className="size-4" />
            Back to Home
          </Link>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="gap-2"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="size-4" />
            Go Back
          </Button>
        </div>
      </main>
    </div>
  )
}
