import { cn } from '@/lib/utils'

type LogoProps = {
  className?: string
  iconClassName?: string
}

/**
 * Morshid logo mark — an eight-pointed "guiding star" (Rub el Hizb),
 * the classic Arabic-geometry star formed by two overlapping squares,
 * with a solid center point suggesting a focused point of guidance.
 *
 * The mark is monochrome ink: it renders entirely in `currentColor`, so the
 * container's text color drives it — no gradient fills. Container styling comes
 * from `className`; the glyph size from `iconClassName`.
 */
export function Logo({ className, iconClassName }: LogoProps) {
  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center text-current',
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
        />
        <circle cx="12" cy="12" r="2.4" />
      </svg>
    </div>
  )
}
