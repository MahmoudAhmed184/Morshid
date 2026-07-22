import { Link } from '@tanstack/react-router'

import { Logo } from '@/components/logo'
import { ModeToggle } from '@/components/ui/mode-toggle'

const segmentLabels: Record<string, string> = {
  courses: 'The Shelf',
  settings: 'Settings',
}

type StudentTopBarProps = {
  pathname: string
}

/**
 * Slim glass chrome for the student's non-chat pages (The Shelf, Settings).
 * The workspace paints its own rail + top bar; these secondary pages get this
 * lightweight bar with a breadcrumb and a wordmark that returns to the tutor.
 */
export function StudentTopBar({ pathname }: StudentTopBarProps) {
  const segment = pathname.split('/').filter(Boolean).at(-1) ?? 'courses'
  const label = segmentLabels[segment] ?? segment

  return (
    <header className="glass-paper sticky top-3 z-40 mx-3 mt-3 flex h-14 shrink-0 items-center justify-between gap-3 rounded-2xl px-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/student/ai-tutor"
          className="flex shrink-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label="Return to the AI Tutor workspace"
        >
          <Logo className="size-8 text-foreground" iconClassName="size-5" />
          <span className="font-display text-[1.125rem] leading-none text-foreground">
            Morshid
          </span>
        </Link>
        <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
        <nav
          aria-label="Breadcrumb"
          className="smallcaps-label hidden min-w-0 items-center gap-1.5 sm:flex"
        >
          <span>Student</span>
          <span aria-hidden>·</span>
          <span className="truncate text-foreground">{label}</span>
        </nav>
      </div>

      <div className="flex items-center gap-1.5">
        <ModeToggle />
      </div>
    </header>
  )
}
