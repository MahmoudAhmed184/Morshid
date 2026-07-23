import { Logo } from '@/components/logo'
import { cn } from '@/lib/utils'

type AuthBrandingPanelProps = {
  className?: string
}

/**
 * The title page — the ink-black left panel of the auth surface.
 *
 * A centered, typeset colophon in the spirit of a university-press half-title:
 * the logo mark, spaced capitals of the wordmark between two printer's rules,
 * a small-caps tagline, and a footnote pinned to the foot of the page. This is
 * the one deliberately centered composition in the product.
 */
export function AuthBrandingPanel({ className }: AuthBrandingPanelProps) {
  return (
    <aside
      className={cn(
        'flex-col justify-between rounded-3xl bg-foreground p-14 text-background shadow-xl',
        className,
      )}
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Logo className="text-background" iconClassName="size-6" />

        <div className="mt-8 w-16 border-t-2 border-background/30" />

        <h1 className="font-display mt-8 indent-[0.35em] text-[3rem] leading-none font-semibold tracking-[0.35em] text-background">
          MORSHID
        </h1>

        <p className="smallcaps-label mt-6 max-w-xs text-background/60">
          A SOCRATIC TUTOR, BOUND TO YOUR COURSE MATERIALS
        </p>

        <div className="mt-8 w-16 border-t-2 border-background/30" />
      </div>

      <p className="footnote text-center text-background/40">
        EST. MMXXVI · EVERY ANSWER HAS A PAGE NUMBER
      </p>
    </aside>
  )
}
