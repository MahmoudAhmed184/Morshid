import { useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'

export function NavigationScrollReset() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      const element = document.getElementById(hash.replace(/^#/u, ''))
      if (element) {
        element.scrollIntoView()
        return
      }
    }

    if (
      typeof window !== 'undefined' &&
      typeof window.scrollTo === 'function'
    ) {
      window.scrollTo(0, 0)
    }

    if (typeof document !== 'undefined') {
      const scrollContainers = document.querySelectorAll<HTMLElement>(
        '[data-slot="sidebar-inset"], [data-slot="student-outlet"], main, .overflow-y-auto',
      )

      for (const container of scrollContainers) {
        if (container.scrollTop !== 0 || container.scrollLeft !== 0) {
          container.scrollTop = 0
          container.scrollLeft = 0
        }
      }
    }
  }, [pathname, hash])

  return null
}
