import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

type RevealProps = {
  children: React.ReactNode
  className?: string
  /** Stagger delay in milliseconds, applied to the fade-up animation. */
  delay?: number
}

/**
 * Scroll-reveal wrapper for marketing sections.
 *
 * Elements start hidden and animate up with the brand `fade-up` keyframe the
 * first time they scroll into view. Anything running with reduced motion — or
 * without IntersectionObserver — is shown immediately with no movement, so the
 * content is never trapped behind an animation.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) {
      return
    }

    // Browsers without IntersectionObserver (or SSR fallbacks) reveal on the
    // next tick so the content is never left hidden.
    if (typeof IntersectionObserver === 'undefined') {
      const timer = window.setTimeout(() => setShown(true), 0)
      return () => window.clearTimeout(timer)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            observer.disconnect()
            break
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={shown && delay ? { animationDelay: `${delay}ms` } : undefined}
      className={cn(
        'motion-reduce:animate-none',
        // Reduced-motion users see content immediately; the fade-up keyframe is
        // globally collapsed to `none`, so no movement occurs for them.
        shown ? 'animate-fade-up' : 'opacity-0 motion-reduce:opacity-100',
        className,
      )}
    >
      {children}
    </div>
  )
}
