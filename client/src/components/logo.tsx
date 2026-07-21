import { cn } from '@/lib/utils'

type LogoProps = {
  className?: string
  iconClassName?: string
}

/**
 * Morshid logo mark — an eight-pointed "guiding star" (Rub el Hizb),
 * the classic Arabic-geometry star formed by two overlapping squares,
 * with an inset star knockout suggesting a focused point of guidance.
 *
 * The mark renders in `currentColor`, so the container's text color drives it.
 * Container styling comes from `className`; the glyph size from `iconClassName`.
 */
export function Logo({ className, iconClassName }: LogoProps) {
  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(140deg,var(--primary),oklch(0.56_0.2_305))] text-primary-foreground shadow-sm ring-1 ring-inset ring-white/15',
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className={cn('size-5', iconClassName)}
        fill="currentColor"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4.8 4.8h14.4v14.4H4.8zM12 1.5l10.5 10.5L12 22.5 1.5 12z"
          opacity="0.95"
        />
        <circle cx="12" cy="12" r="2.6" fill="var(--primary)" />
      </svg>
    </div>
  )
}
