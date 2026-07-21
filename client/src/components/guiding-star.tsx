import { cn } from '@/lib/utils'

type GuidingStarProps = {
  className?: string
  /**
   * Render the inset "focused point of guidance" core — the same knockout the
   * logo mark carries. Enable it when the star stands in for the brand (e.g. the
   * AI tutor avatar); leave it off for lightweight ornamental accents.
   */
  withCore?: boolean
}

/**
 * Decorative eight-pointed "guiding star" (Rub el Hizb) — the same geometry as
 * the brand logo mark, drawn in `currentColor` so the container's text color
 * drives it. Used for sparing gold/brand accents on marketing surfaces, the AI
 * tutor avatar, and warm empty-state moments. Purely ornamental, so it is
 * hidden from assistive tech.
 */
export function GuidingStar({ className, withCore = false }: GuidingStarProps) {
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
      {withCore ? (
        <circle cx="12" cy="12" r="2.6" fill="currentColor" opacity="0.4" />
      ) : null}
    </svg>
  )
}
