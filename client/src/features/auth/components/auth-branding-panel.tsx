import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'

type AuthBrandingPanelProps = {
  className?: string
}

/**
 * The title page — the ink-black left panel of the auth surface.
 *
 * Enhanced with the custom floating illuminated pages artwork background while
 * maintaining crisp, high-contrast typeset colophon style in both light and dark themes.
 */
export function AuthBrandingPanel({ className }: AuthBrandingPanelProps) {
  return (
    <aside
      className={cn(
        'relative overflow-hidden rounded-3xl bg-foreground text-background shadow-2xl border border-background/10 dark:bg-background dark:text-foreground dark:border-foreground/10',
        className,
      )}
    >
      {/* Background artwork featuring floating illuminated manuscript pages */}
      <div className="absolute inset-0 z-0">
        <img
          src="/login-art.jpg"
          alt="Morshid Socratic AI Artwork"
          className="h-full w-full object-cover object-center opacity-70 transition-opacity duration-500"
        />
        {/* Soft radial vignette to preserve text legibility at top and bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/85 via-foreground/45 to-foreground/90 dark:from-background/85 dark:via-background/45 dark:to-background/90" />
      </div>

      <div className="relative z-10 flex h-full w-full flex-col justify-between p-12 sm:p-14">
        <div className="flex flex-1 flex-col items-center justify-start pt-10 text-center sm:pt-14">
          <Logo
            className="text-background dark:text-foreground"
            iconClassName="size-7"
          />

          <div className="mt-6 w-16 border-t border-background/40 dark:border-foreground/40" />

          <h1 className="font-display mt-6 indent-[0.35em] text-[3.25rem] font-bold leading-none tracking-[0.35em] text-background dark:text-foreground drop-shadow-md">
            MORSHID
          </h1>

          <p className="smallcaps-label mt-5 max-w-xs text-xs font-medium tracking-widest text-background/90! dark:text-foreground/90! drop-shadow">
            A SOCRATIC TUTOR, BOUND TO YOUR COURSE MATERIALS
          </p>

          <div className="mt-6 w-16 border-t border-background/40 dark:border-foreground/40" />
        </div>

        <p className="footnote text-center text-xs tracking-wider text-background/70! dark:text-foreground/70!">
          EST. MMXXVI · EVERY ANSWER HAS A PAGE NUMBER
        </p>
      </div>
    </aside>
  )
}
