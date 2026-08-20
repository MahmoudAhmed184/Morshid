import { useQuery } from '@tanstack/react-query'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { adminAiCapacityQueryOptions } from '../ai-capacity.queries'
import type { AiReadinessStatus } from '../ai-capacity.schema'

function getStatusBadge(
  status: AiReadinessStatus | 'Ready' | 'Pressured' | 'Blocked',
) {
  switch (status) {
    case 'Ready':
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700">Ready</Badge>
      )
    case 'Pressured':
      return (
        <Badge className="bg-amber-600 hover:bg-amber-700">Pressured</Badge>
      )
    case 'Blocked':
      return <Badge variant="destructive">Blocked</Badge>
    case 'Unknown':
    default:
      return <Badge variant="secondary">Unknown</Badge>
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold tracking-tight">
              AI Capacity & Readiness
            </h2>
            {data && getStatusBadge(data.overallStatus)}
          </div>
          <p className="text-sm text-muted-foreground">
            Operational snapshot of configured AI upstream project pools and
            embedding quotas.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => capacityQuery.refetch()}
          disabled={capacityQuery.isFetching}
        >
          {capacityQuery.isFetching ? 'Refreshing...' : 'Refresh Snapshot'}
        </Button>
      </div>

      {/* Disclaimer Banner */}
      <Alert className="border-amber-500/50 bg-amber-50/50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
        <AlertTitle className="font-semibold">
          Local Operational View
        </AlertTitle>
        <AlertDescription className="text-sm">
          {data?.disclaimer ??
            'Local operational view based on in-memory and cache state. Actual upstream Google Cloud quotas, billing accounts, and project configurations are managed in Google Cloud Console and may differ.'}
        </AlertDescription>
      </Alert>

      {capacityQuery.isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : data ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Chat Pool Card */}
          <Card data-testid="chat-pool-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-semibold">
                  Chat Upstream Pool
                </CardTitle>
                <CardDescription>
                  Multi-project pool rotation and rate limit cooldowns
                </CardDescription>
              </div>
              {getStatusBadge(data.chatPool.status)}
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">
                    {data.chatPool.totalProjects}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total Projects
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {data.chatPool.availableProjects}
                  </div>
                  <div className="text-xs text-muted-foreground">Available</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {data.chatPool.cooledDownProjects}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Cooling Down
                  </div>
                </div>
              </div>

              {data.chatPool.cooldownDetails.length > 0 ? (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    Projects in Cooldown
                  </div>
                  <div className="divide-y rounded-md border text-sm">
                    {data.chatPool.cooldownDetails.map((detail) => (
                      <div
                        key={detail.projectIndex}
                        className="flex items-center justify-between p-2"
                      >
                        <span className="font-mono text-xs">
                          Project #{detail.projectIndex + 1}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Cooldown:{' '}
                          {Math.ceil(detail.cooldownRemainingMs / 1000)}s
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  All configured upstream chat projects are active with zero
                  cooldowns.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Embedding & Quota Card */}
          <Card data-testid="embedding-quota-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base font-semibold">
                  Embedding & Quota Guard
                </CardTitle>
                <CardDescription>
                  Vector embeddings and rate limit quotas
                </CardDescription>
              </div>
              {getStatusBadge(data.embedding.status)}
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold truncate">
                    {data.embedding.provider}
                  </div>
                  <div className="text-xs text-muted-foreground">Provider</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold truncate">
                    {data.embedding.model}
                  </div>
                  <div className="text-xs text-muted-foreground">Model</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-semibold">
                    {data.embedding.dimensions}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Dimensions
                  </div>
                </div>
              </div>

              {data.embedding.quotaDimensions &&
              data.embedding.quotaDimensions.length > 0 ? (
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-semibold uppercase text-muted-foreground">
                    Metered Quota Dimensions
                  </div>
                  <div className="space-y-2">
                    {data.embedding.quotaDimensions.map((dim) => {
                      const isTokenBucket = dim.mode === 'token_bucket'
                      const percent = isTokenBucket
                        ? Math.min(
                            100,
                            Math.round(
                              (dim.availableOrUsed / dim.capacity) * 100,
                            ),
                          )
                        : Math.min(
                            100,
                            Math.round(
                              (dim.availableOrUsed / dim.capacity) * 100,
                            ),
                          )

                      return (
                        <div key={dim.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">
                              {formatDimensionName(dim.name)}
                            </span>
                            <span className="text-muted-foreground">
                              {isTokenBucket
                                ? `${Math.round(dim.availableOrUsed)} / ${dim.capacity} available`
                                : `${dim.availableOrUsed} / ${dim.capacity} used`}
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                            <div
                              className={`h-full transition-all ${
                                dim.status === 'Blocked'
                                  ? 'bg-destructive'
                                  : dim.status === 'Pressured'
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Running on deterministic embeddings without remote rate limit
                  quotas.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {data && (
        <div className="text-right text-xs text-muted-foreground">
          Observed at {new Date(data.observedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}
