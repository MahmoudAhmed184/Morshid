import { ModeToggle } from '@/components/ui/mode-toggle'
import { cn } from '@/lib/utils'

export function getUserInitials(displayName?: string, fallback = 'U') {
  if (!displayName) {
    return fallback
  }

  return (
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || fallback
  )
}

type DashboardHeaderProps = {
  /** Breadcrumb / contextual label rendered on the left (`.smallcaps-label`). */
  breadcrumb?: React.ReactNode
  /** Leading slot — typically the mobile navigation trigger. */
  leading?: React.ReactNode
  /**
   * Legacy contextual slot (e.g. the tutor breadcrumb). When present it takes
   * the breadcrumb region so existing callers keep rendering their content.
   */
  content?: React.ReactNode
  /** Extra actions rendered to the left of the mode toggle. */
  actions?: React.ReactNode
  className?: string
  // Legacy props kept accepted (and ignored) so existing callers still compile.
  displayName?: string
  email?: string
  searchLabel?: string
  searchPlaceholder?: string
  showHelp?: boolean
}

/**
 * Studio Shell header — a floating frosted-glass bar. Positioning
 * (`sticky top-3 z-40 mx-3`) is supplied by the surrounding shell via
 * `className` so the same bar can float in any content column.
 */
export function DashboardHeader({
  breadcrumb,
  leading,
  content,
  actions,
  className,
}: DashboardHeaderProps) {
  return (
    <header
      className={cn(
        'glass-paper flex h-14 items-center justify-between gap-3 rounded-2xl px-4 shadow-sm',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        {content ?? breadcrumb}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {actions}
        <ModeToggle />
      </div>
    </header>
  )
}
