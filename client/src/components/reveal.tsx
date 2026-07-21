import * as React from 'react'

import { cn } from '@/lib/utils'

type RevealProps = React.ComponentProps<'div'> & {
  /** Stagger delay in milliseconds applied to the reveal animation. */
  delay?: number
}

/**
 * Reveal — plays `animate-fade-up` ONCE the first time the element crosses 15%
 * visibility, then disconnects. SSR-safe (renders its children on the server and
 * on first client paint). Falls back to rendering plainly — no hidden state —
 * when IntersectionObserver is unavailable or the user prefers reduced motion.
 *
 * Used by landing sections only.
 */
export function Reveal({
  className,
  style,
  delay,
  children,
  ...props
}: RevealProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = React.useState(false)

  React.useEffect(() => {
    const node = ref.current

    if (!node) return

    // No IntersectionObserver, or reduced motion → render plainly, always shown.
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion) {
      // Deferred to the next frame so the reveal is not applied synchronously
      // inside the effect body. Under reduced motion the animation classes are
      // gated behind `motion-safe:`, so children are visible either way.
      const frame = requestAnimationFrame(() => setRevealed(true))

      return () => cancelAnimationFrame(frame)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true)
            observer.disconnect()
            break
          }
        }
      },
      { threshold: 0.15 },
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      data-slot="reveal"
      data-revealed={revealed || undefined}
      className={cn(
        revealed ? 'motion-safe:animate-fade-up' : 'motion-safe:opacity-0',
        className,
      )}
      style={delay ? { animationDelay: `${delay}ms`, ...style } : style}
      {...props}
    >
      {children}
    </div>
  )
}
