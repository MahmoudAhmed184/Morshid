import { queryOptions, useQuery } from '@tanstack/react-query'
import {
  Activity,
  CheckCircle2,
  Database,
  RefreshCw,
  Server,
  TriangleAlert,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { fetchReadinessStatus } from '@/lib/api/health'
import { clientEnv } from '@/lib/env'

const runtimeDependencies = ['database', 'redis', 'pgvector'] as const

const readinessQueryOptions = queryOptions({
  queryKey: ['server-readiness'],
  queryFn: () => fetchReadinessStatus(),
})

function getReadinessLabel(
  isPending: boolean,
  isError: boolean,
  status?: string,
) {
  if (isPending) {
    return 'checking'
  }

  if (isError) {
    return 'offline'
  }

  return status === 'ok' ? 'ready' : 'degraded'
}

function dependencyIsUp(
  details: Record<string, unknown> | undefined,
  key: string,
) {
  const value = details?.[key]

  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    value.status === 'up'
  )
}

function getRuntimeReadinessLabel(
  isPending: boolean,
  isError: boolean,
  details?: Record<string, unknown>,
) {
  if (isPending) {
    return 'checking'
  }

  if (isError) {
    return 'offline'
  }

  return runtimeDependencies.every((dependency) =>
    dependencyIsUp(details, dependency),
  )
    ? 'ready'
    : 'degraded'
}

export function DevelopmentStatusPage() {
  const readiness = useQuery(readinessQueryOptions)

  const readinessLabel = getReadinessLabel(
    readiness.isPending,
    readiness.isError,
    readiness.data?.status,
  )
  const readinessIsReady = readinessLabel === 'ready'
  const runtimeReadinessLabel = getRuntimeReadinessLabel(
    readiness.isPending,
    readiness.isError,
    readiness.data?.details,
  )
  const runtimeIsReady = runtimeReadinessLabel === 'ready'

  return (
    <main className="min-h-svh bg-background">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit">
              foundation scaffold
            </Badge>
            <div>
              <h1 className="text-3xl font-semibold tracking-normal text-foreground">
                Morshid development status
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Local client and API readiness for the initial workspace.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              if (readiness.isFetching) {
                return
              }

              void readiness.refetch()
            }}
            disabled={readiness.isRefetching}
          >
            <RefreshCw />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-4 text-primary" />
                Client
              </CardTitle>
              <CardDescription>TanStack Start React</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge>ready</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="size-4 text-primary" />
                API
              </CardTitle>
              <CardDescription>{clientEnv.VITE_API_BASE_URL}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={readinessIsReady ? 'default' : 'secondary'}>
                {readinessLabel}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="size-4 text-primary" />
                Runtime
              </CardTitle>
              <CardDescription>PostgreSQL/pgvector and Redis</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant={runtimeIsReady ? 'default' : 'secondary'}>
                {runtimeReadinessLabel}
              </Badge>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Readiness detail</CardTitle>
            <CardDescription>
              The NestJS readiness endpoint will report dependency health once
              the server modules are configured.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {readiness.isError ? (
              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Server readiness is not available yet.
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {readiness.data
                    ? JSON.stringify(readiness.data.details ?? readiness.data)
                    : 'Waiting for the readiness response.'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
