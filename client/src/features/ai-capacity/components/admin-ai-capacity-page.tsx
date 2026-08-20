import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  Info,
  Layers,
  RefreshCw,
  RotateCw,
  Server,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { adminAiCapacityQueryOptions } from '../ai-capacity.queries'
import type { AiReadinessStatus } from '../ai-capacity.schema'

function getStatusBadge(
  status: AiReadinessStatus | 'Ready' | 'Pressured' | 'Blocked',
) {
  switch (status) {
    case 'Ready':
      return (
        <Badge className="bg-emerald-600/90 hover:bg-emerald-700 text-white font-medium text-xs px-2.5">
          Ready
        </Badge>
      )
    case 'Pressured':
      return (
        <Badge className="bg-amber-600/90 hover:bg-amber-700 text-white font-medium text-xs px-2.5">
          Pressured
        </Badge>
      )
    case 'Blocked':
      return (
        <Badge variant="destructive" className="font-medium text-xs px-2.5">
          Blocked
        </Badge>
      )
    case 'Unknown':
    default:
      return (
        <Badge variant="secondary" className="font-medium text-xs px-2.5">
          Unknown
        </Badge>
      )
  }
}

function formatDimensionName(name: string): string {
  switch (name) {
    case 'requests_minute':
      return 'Requests / Minute'
    case 'input_tokens_minute':
      return 'Input Tokens / Minute'
    case 'requests_hour':
      return 'Requests / Hour'
    case 'requests_day':
      return 'Requests / Day'
    case 'requests_month':
      return 'Requests / 30 Days'
    default:
      return name
  }
}

export function AdminAiCapacityPage() {
  const capacityQuery = useQuery(adminAiCapacityQueryOptions())
  const data = capacityQuery.data

  return (
    <div className="space-y-4">
      <Card className="relative -mx-4 overflow-hidden rounded-none border-x-0 py-0 sm:mx-0 sm:rounded-xl sm:border-x">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(ellipse_at_65%_100%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_65%)]"
          aria-hidden
        />
        <CardContent className="relative flex flex-col gap-6 px-5 py-5 sm:px-6">
          {/* Header Row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              <Cpu className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="text-base font-medium text-foreground">
                AI Capacity & Readiness
              </h2>
              {data && getStatusBadge(data.overallStatus)}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void capacityQuery.refetch()}
              disabled={capacityQuery.isFetching}
              className="gap-1.5 self-start sm:self-auto"
            >
              <RefreshCw
                className={cn(
                  'size-3.5',
                  capacityQuery.isFetching && 'animate-spin',
                )}
                aria-hidden
              />
              {capacityQuery.isFetching ? 'Refreshing...' : 'Refresh Snapshot'}
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-card/50 p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <Info
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden
              />
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  Local Operational View
                </p>
                <p className="text-xs leading-relaxed">
                  {data?.disclaimer ??
                    'Telemetry snapshot based on local server state and distributed cache keys. Actual Google Cloud upstream quotas and billing accounts are configured in Google Cloud Console.'}
                </p>
              </div>
            </div>
          </div>

          {capacityQuery.isError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Failed to load AI capacity telemetry.</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void capacityQuery.refetch()}
                  className="h-7 text-xs"
                >
                  <RotateCw className="mr-1.5 size-3" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {capacityQuery.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-56 rounded-xl" />
              <Skeleton className="h-56 rounded-xl" />
            </div>
          ) : data ? (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Chat Upstream Pool Card */}
              <div
                data-testid="chat-pool-card"
                className="flex flex-col justify-between gap-4 rounded-xl border border-border/80 bg-background/60 p-4.5"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Server className="size-4" aria-hidden />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          Chat Upstream Pool
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Multi-project rotation & cooldowns
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(data.chatPool.status)}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                      <div className="text-xl font-bold tracking-tight text-foreground">
                        {data.chatPool.totalProjects}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Total Projects
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                      <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                        {data.chatPool.availableProjects}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Available Projects
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                      <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                        {data.chatPool.cooledDownProjects}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Cooling Down
                      </div>
                    </div>
                  </div>

                  {data.chatPool.cooldownDetails.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Projects in Cooldown
                      </span>
                      <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-muted/20 text-xs">
                        {data.chatPool.cooldownDetails.map((detail) => (
                          <div
                            key={detail.projectIndex}
                            className="flex items-center justify-between p-2 px-2.5"
                          >
                            <span className="font-mono text-xs text-foreground">
                              Project #{detail.projectIndex + 1}
                            </span>
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                              Cooldown:{' '}
                              {Math.ceil(detail.cooldownRemainingMs / 1000)}s
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                      <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      All upstream projects active with zero active cooldowns.
                    </p>
                  )}
                </div>
              </div>

              {/* Embedding & Quota Guard Card */}
              <div
                data-testid="embedding-quota-card"
                className="flex flex-col justify-between gap-4 rounded-xl border border-border/80 bg-background/60 p-4.5"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Layers className="size-4" aria-hidden />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          Embedding & Quota Guard
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Vector dimensions and rate meters
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(data.embedding.status)}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                      <div className="truncate text-xs font-semibold text-foreground">
                        {data.embedding.provider}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Provider
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                      <div className="truncate text-xs font-semibold text-foreground">
                        {data.embedding.model}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Model
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/30 p-2.5">
                      <div className="text-xs font-semibold text-foreground">
                        {data.embedding.dimensions}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Dimensions
                      </div>
                    </div>
                  </div>

                  {data.embedding.quotaDimensions &&
                  data.embedding.quotaDimensions.length > 0 ? (
                    <div className="space-y-2.5 pt-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Metered Quota Dimensions
                      </span>
                      <div className="space-y-2">
                        {data.embedding.quotaDimensions.map((dim) => {
                          const isTokenBucket = dim.mode === 'token_bucket'
                          const percent = Math.min(
                            100,
                            Math.round(
                              (dim.availableOrUsed / dim.capacity) * 100,
                            ),
                          )

                          return (
                            <div key={dim.name} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium text-foreground">
                                  {formatDimensionName(dim.name)}
                                </span>
                                <span className="text-muted-foreground text-[11px]">
                                  {isTokenBucket
                                    ? `${Math.round(dim.availableOrUsed)} / ${dim.capacity} available`
                                    : `${dim.availableOrUsed} / ${dim.capacity} used`}
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className={cn(
                                    'h-full transition-all duration-300',
                                    dim.status === 'Blocked'
                                      ? 'bg-destructive'
                                      : dim.status === 'Pressured'
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500',
                                  )}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                      <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      Running on deterministic local embeddings without upstream
                      quota pressure.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Footer observation info */}
          {data && (
            <div className="flex items-center justify-between border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
              <span>Telemetry snapshot</span>
              <span>
                Observed at {new Date(data.observedAt).toLocaleTimeString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
