import { cn } from '@/lib/utils'

type GuidingStarProps = {
  className?: string
}

/**
 * Decorative eight-pointed "guiding star" (Rub el Hizb) — the same geometry as
 * the brand logo mark, drawn in `currentColor` for sparing gold accents in the
 * marketing surfaces. Purely ornamental, so it is hidden from assistive tech.
 */
export function GuidingStar({ className }: GuidingStarProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-4', className)}
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.8 4.8h14.4v14.4H4.8zM12 1.5l10.5 10.5L12 22.5 1.5 12z"
      />
    </svg>
  )
}
