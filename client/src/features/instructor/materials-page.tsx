import { FileText, Search } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function SectionHeader({
  description,
  title,
}: {
  description: string
  title: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  )
}

export function MaterialsPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <FileText className="size-4 text-primary" aria-hidden />
          Instructor Workspace
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Materials
        </h1>
      </div>

      <section className="space-y-3">
        <SectionHeader
          title="Materials"
          description="Shell view for course source readiness. Upload and ingestion are deferred."
        />
        <Card className="rounded-[8px] border-border bg-card py-0 text-card-foreground ring-0">
          <CardHeader className="border-b border-border px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                <FileText className="size-4 text-primary" aria-hidden />
                Course Materials
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="flex h-8 min-w-44 items-center rounded-[6px] border border-border bg-background px-3 text-xs text-muted-foreground">
                  <Search className="mr-2 size-3.5" aria-hidden />
                  Search by title
                </div>
                <div className="flex h-8 items-center rounded-[6px] border border-border px-3 text-xs text-muted-foreground">
                  All Topics
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-4">
            <div className="overflow-hidden rounded-[8px] border border-border">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-muted/50 px-4 py-2 text-[0.68rem] font-medium text-muted-foreground uppercase">
                <span>Material Name</span>
                <span>Status</span>
                <span>Actions</span>
              </div>
              <div className="grid min-h-28 place-items-center px-4 py-8 text-center">
                <div className="max-w-sm space-y-2">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-[8px] bg-muted text-primary">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-file-clock"
                      aria-hidden
                    >
                      <path d="M16 22h2a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v3" />
                      <polyline points="14 2 14 8 20 8" />
                      <path d="M4 12h8" />
                      <path d="M4 18h12" />
                      <path d="M9 12h.01" />
                      <path d="M9 18h.01" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Materials are not connected yet
                  </p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    This panel is reserved for Sprint 2 upload, processing, and
                    source readiness status.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
