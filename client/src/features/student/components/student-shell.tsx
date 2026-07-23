import { Outlet } from '@tanstack/react-router'
import { BookMarked } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/ui/mode-toggle'
import { SidebarInset, useSidebar } from '@/components/ui/sidebar'
import { useStudentChromeSources } from '@/features/student/components/student-chrome-context'
import { cn } from '@/lib/utils'

/**
 * T9.2 — the two icon-buttons shared by both cluster states: the sources toggle
 * (only when the /chat workspace registered a control) and the theme switcher
 * (always). The sources toggle keeps its two-breakpoint behaviour from the old
 * top bar: on lg+ it toggles the inline panel (`aria-pressed`), below lg it
 * opens the mobile Sheet.
 */
function ClusterButtons() {
  const sources = useStudentChromeSources()

  return (
    <>
      {sources ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Toggle sources and citations"
            aria-pressed={sources.isOpen}
            onClick={sources.onToggle}
            className="hidden lg:inline-flex"
          >
            <BookMarked
              className="size-4 text-muted-foreground"
              strokeWidth={1.75}
              aria-hidden
            />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Show sources and citations"
            onClick={sources.onOpenMobile}
            className="lg:hidden"
          >
            <BookMarked
              className="size-4 text-muted-foreground"
              strokeWidth={1.75}
              aria-hidden
            />
          </Button>
        </>
      ) : null}
      <ModeToggle />
    </>
  )
}

/**
 * T9 corner treatment. When the sidebar is expanded on md:+ the content sits as
 * a rounded panel inset in a `bg-sidebar` frame, with a slim top band whose
 * right end holds the control cluster (integrated — no border/shadow). When the
 * sidebar is collapsed (or on mobile off-canvas) the frame disappears, the
 * content goes full-bleed, and the cluster floats as a `glass-paper` chip fixed
 * to the top-right — mirroring the top-left trigger cluster.
 */
export function StudentShell() {
  const { state, isMobile } = useSidebar()
  const framed = state === 'expanded' && !isMobile

  return (
    <SidebarInset
      className={cn(
        'flex min-h-0 flex-col overflow-hidden',
        framed ? 'md:bg-sidebar' : 'bg-background',
      )}
    >
      {framed ? (
        <div className="hidden h-12 shrink-0 items-center justify-end gap-1 pr-2 md:flex">
          <ClusterButtons />
        </div>
      ) : null}

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden bg-background',
          framed && 'md:rounded-t-2xl',
        )}
      >
        <Outlet />
      </div>

      {framed ? null : (
        <div className="glass-paper fixed top-3 right-3 z-50 flex gap-1 rounded-xl p-1 shadow-sm">
          <ClusterButtons />
        </div>
      )}
    </SidebarInset>
  )
}
