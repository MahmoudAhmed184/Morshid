import { BookOpenCheck, CircleAlert } from 'lucide-react'

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
        {citations.flatMap((citation) =>
          citation.evidence.map((evidence) => (
            <li key={`${citation.materialId}:${evidence.chunkId}`}>
              <Badge
                className="h-auto max-w-full whitespace-normal"
                variant="outline"
              >
                [{citation.materialTitle}, chunk {evidence.chunkNumber}]
              </Badge>
            </li>
          )),
        )}
      </ul>

      <Accordion className="mt-2">
        <AccordionItem className="border-0" value="sources">
          <AccordionTrigger className="py-2 no-underline hover:no-underline">
            <span className="flex items-center gap-2">
              <BookOpenCheck className="size-4" aria-hidden />
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
    <li className="min-w-0 rounded-xl border border-border bg-muted/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 break-words font-medium text-foreground">
          {citation.materialTitle}
        </p>
        <Badge variant={citation.sourceAvailable ? 'secondary' : 'destructive'}>
          {citation.sourceAvailable ? 'Available' : 'Unavailable'}
        </Badge>
      </div>

      {citation.sourceAvailable ? (
        <ul className="mt-2 space-y-2">
          {citation.evidence.map((evidence) => (
            <li key={evidence.chunkId}>
              <p className="text-xs font-medium text-muted-foreground">
                Chunk {evidence.chunkNumber}
              </p>
              <p className="mt-1 break-words text-sm leading-5 text-foreground">
                {evidence.excerpt}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          This source is no longer available. No excerpt is shown.
        </p>
      )}
    </li>
  )
}
