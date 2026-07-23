import { BookMarked, CircleAlert } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import type { ChatMessage } from '@/features/student/schemas/student-chat.schema'

type ChatCitation = ChatMessage['citations'][number]

interface StudentCitationSourcesProps {
  citations: ChatCitation[]
}

export function StudentCitationSources({
  citations,
}: StudentCitationSourcesProps) {
  if (citations.length === 0) {
    return null
  }

  return (
    <div className="mt-3 border-t border-border/70 pt-3">
      <ul aria-label="Inline citations" className="flex flex-wrap gap-1.5">
        {citations.map((citation) => (
          <li key={`${citation.order}:${citation.materialId}`}>
            <Badge
              className="h-auto max-w-full whitespace-normal border-info/25 bg-info/5 font-mono text-xs text-info"
              variant="outline"
            >
              [{citation.order}] {citation.materialTitle}
            </Badge>
          </li>
        ))}
      </ul>

      <Accordion className="mt-2">
        <AccordionItem className="border-0" value="sources">
          <AccordionTrigger className="py-2 no-underline hover:no-underline">
            <span className="flex items-center gap-2">
              <BookMarked
                className="size-4 text-muted-foreground"
                strokeWidth={1.75}
                aria-hidden
              />
              Sources ({citations.length})
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-0">
            <ol aria-label="Response sources" className="space-y-2">
              {citations.map((citation) => (
                <CitationSource
                  key={`${citation.order}:${citation.materialId}`}
                  citation={citation}
                />
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

function CitationSource({ citation }: { citation: ChatCitation }) {
  return (
    <li className="min-w-0 rounded-xl border border-border bg-secondary/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 break-words font-medium text-foreground">
          {citation.materialTitle}
        </p>
        <Badge variant={citation.sourceAvailable ? 'secondary' : 'outline'}>
          {citation.sourceAvailable ? 'Available' : 'Unavailable'}
        </Badge>
      </div>

      {citation.sourceAvailable ? (
        <div className="mt-3 space-y-3">
          {citation.evidence.map((evidence) => (
            <figure
              key={evidence.chunkId}
              className="border-l-2 border-info/30 pl-3"
            >
              <blockquote className="break-words text-xs leading-5 text-muted-foreground">
                {evidence.excerpt}
              </blockquote>
              <figcaption className="footnote mt-1 font-mono">
                Source passage {evidence.chunkNumber}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          This source is no longer available. No excerpt is shown.
        </p>
      )}
    </li>
  )
}
