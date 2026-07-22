import { BookMarked, FileText, Lock, PanelRightClose } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ChatMessage } from '@/features/student/schemas/student-chat.schema'
import type { StudentCourse } from '@/features/student/schemas/student-course.schema'
import { cn } from '@/lib/utils'

interface StudentSourcesPanelProps {
  course: StudentCourse
  messages: ChatMessage[]
  onCollapse?: () => void
  className?: string
}

export function StudentSourcesPanel({
  course,
  messages,
  onCollapse,
  className,
}: StudentSourcesPanelProps) {
  const citedSources = messages.flatMap((message) =>
    message.citations.map((citation) => ({
      citation,
      messageId: message.id,
    })),
  )

  return (
    <aside
      aria-label="Sources and citations"
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <h2 className="smallcaps-label flex items-center gap-2">
          <BookMarked
            className="size-4 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden
          />
          Sources &amp; citations
        </h2>
        {onCollapse ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Collapse sources panel"
            onClick={onCollapse}
          >
            <PanelRightClose
              className="size-4 text-muted-foreground"
              strokeWidth={1.75}
              aria-hidden
            />
          </Button>
        ) : null}
      </header>

      <div className="scrollbar-themed min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-4">
        <section aria-labelledby="conversation-sources-heading">
          <h3
            id="conversation-sources-heading"
            className="smallcaps-label pb-3"
          >
            Cited in this conversation
          </h3>

          {citedSources.length > 0 ? (
            <ol className="space-y-3">
              {citedSources.map(({ citation, messageId }) => (
                <li
                  key={`${messageId}-${citation.materialId}-${citation.order}`}
                  className="rounded-xl border bg-background/40 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {citation.materialTitle}
                    </p>
                    <Badge
                      variant={citation.sourceAvailable ? 'success' : 'outline'}
                      className="font-mono"
                    >
                      [{citation.order}]
                    </Badge>
                  </div>

                  {citation.sourceAvailable ? (
                    <div className="mt-3 space-y-3">
                      {citation.evidence.map((evidence) => (
                        <figure
                          key={evidence.chunkId}
                          className="border-l-2 border-primary/30 pl-3"
                        >
                          <blockquote className="text-xs leading-5 text-muted-foreground">
                            {evidence.excerpt}
                          </blockquote>
                          <figcaption className="footnote mt-1 font-mono">
                            Source passage {evidence.chunkNumber}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  ) : (
                    <p className="footnote mt-2">
                      This source is no longer available.
                    </p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="footnote leading-5">
              Cited course passages will appear here when the tutor grounds a
              response in uploaded material.
            </p>
          )}
        </section>

        <section aria-label="About this notebook">
          <h3 className="smallcaps-label pb-3">About this notebook</h3>

          <div className="rounded-xl border bg-background/40 p-4">
            <p className="text-sm font-medium text-foreground">
              {course.title}
            </p>
            <p className="footnote mt-1 font-mono">{course.code}</p>
            <div className="rule mt-3 flex flex-wrap items-center gap-2 pt-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-medium text-primary">
                <FileText className="size-3.5" strokeWidth={1.75} aria-hidden />
                Assigned course
              </span>
              <span className="footnote">Private notebook</span>
            </div>
          </div>

          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <Lock
              className="mt-0.5 size-3.5 shrink-0"
              strokeWidth={1.75}
              aria-hidden
            />
            <span>
              Private saved history — only you can see these conversations.
              Flagged exchanges may be reviewed by your instructor.
            </span>
          </p>
        </section>
      </div>
    </aside>
  )
}
