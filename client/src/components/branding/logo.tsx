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
        'flex size-10 shrink-0 items-center justify-center',
        className,
      )}
    >
      <img
        src="/logo.png"
        alt="Morshid Logo"
        className={cn('size-5 object-contain dark:hidden', iconClassName)}
      />
      <img
        src="/logo-white.png"
        alt="Morshid Logo"
        className={cn('hidden size-5 object-contain dark:block', iconClassName)}
      />
    </div>
  )
}
