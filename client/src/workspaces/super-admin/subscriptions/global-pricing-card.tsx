import { ArrowRight, Calendar, Check, Globe, Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useUpdateGlobalPricingMutation } from '@/features/subscriptions/interface'
import type { GlobalPricing } from '@/features/subscriptions/interface'

type GlobalPricingCardProps = {
  pricing: GlobalPricing | null
  isLoading?: boolean
}

function formatDate(isoString?: string | null) {
  if (isoString === undefined || isoString === null || isoString === '') {
    return '—'
  }
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(isoString))
  } catch {
    return isoString
  }
}

export function GlobalPricingCard({
  pricing,
  isLoading = false,
}: GlobalPricingCardProps) {
  const currentPrice = pricing?.defaultPricePerSeat ?? 10.0
  const nextScheduledPrice = pricing?.nextPricePerSeat ?? null
  const nextEffectiveDate = pricing?.nextPriceEffectiveAt ?? null

  const [customInput, setCustomInput] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [savedRecently, setSavedRecently] = useState(false)

  const updateMutation = useUpdateGlobalPricingMutation()

  const activeInputValue = customInput ?? currentPrice.toString()
  const parsedPrice = Number.parseFloat(activeInputValue)
  const targetComparePrice = nextScheduledPrice ?? currentPrice
  const hasChanged =
    !Number.isNaN(parsedPrice) &&
    parsedPrice !== targetComparePrice &&
    parsedPrice >= 0

  async function handleSave(e?: React.FormEvent) {
    if (e !== undefined) {
      e.preventDefault()
    }
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setErrorMessage('Price must be a valid non-negative number.')
      return
    }

    setErrorMessage(null)
    try {
      await updateMutation.mutateAsync({
        defaultPricePerSeat: parsedPrice,
      })
      setCustomInput(null)
      setSavedRecently(true)
      setTimeout(() => setSavedRecently(false), 4000)
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to update global pricing.',
      )
    }
  }

  return (
    <Card className="border shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Globe className="size-4" />
          </div>
          <CardTitle className="text-lg">Global Pricing Standard</CardTitle>
        </div>
        <CardDescription>
          Base student seat rate applied to universities without custom
          overrides. Existing universities keep their current cycle rate and
          adopt updates at their next anniversary renewal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Published and optionally scheduled renewal rates */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-baseline gap-1.5 rounded-lg border bg-muted/30 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              Published Renewal Rate:
            </span>
            <span className="font-bold text-foreground">
              ${currentPrice.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">/ seat</span>
          </div>

          {nextScheduledPrice !== null ? (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-medium text-foreground">
              <ArrowRight className="size-3.5 text-primary shrink-0" />
              <span>Scheduled Renewal Rate:</span>
              <Badge variant="default" className="font-bold text-xs">
                ${nextScheduledPrice.toFixed(2)} / seat
              </Badge>
              <span className="text-muted-foreground">
                (effective {formatDate(nextEffectiveDate)})
              </span>
            </div>
          ) : null}
        </div>

        <form
          onSubmit={(e) => void handleSave(e)}
          className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pt-1"
        >
          <div className="space-y-1.5">
            <label
              htmlFor="global-price-input"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Set default renewal rate
            </label>
            <div className="relative flex items-center max-w-xs">
              <span className="pointer-events-none absolute left-3 text-sm font-semibold text-muted-foreground">
                $
              </span>
              <Input
                id="global-price-input"
                type="number"
                step="0.01"
                min="0"
                max="100000"
                disabled={isLoading || updateMutation.isPending}
                value={activeInputValue}
                onChange={(e) => {
                  setCustomInput(e.target.value)
                  setErrorMessage(null)
                }}
                className="pl-7 pr-4 font-semibold text-base"
                placeholder="10.00"
              />
            </div>
            {errorMessage !== null ? (
              <p className="text-xs font-medium text-destructive">
                {errorMessage}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="size-3.5" />
              <span>Updated: {formatDate(pricing?.updatedAt)}</span>
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={
                isLoading ||
                updateMutation.isPending ||
                !hasChanged ||
                Number.isNaN(parsedPrice)
              }
              className="gap-1.5"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving...
                </>
              ) : savedRecently ? (
                <>
                  <Check className="size-3.5 text-emerald-500" />
                  Saved for Upcoming Renewals
                </>
              ) : (
                'Save Renewal Rate'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
