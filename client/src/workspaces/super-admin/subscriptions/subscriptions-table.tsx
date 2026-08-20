import { Link } from '@tanstack/react-router'
import { DollarSign, Edit2, TrendingUp, Users } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { StatusBadge } from '@/components/ui/custom/status-badge/status-badge'
import type { UniversitySubscriptionItem } from '@/features/subscriptions/interface'
import { EditCustomPriceDialog } from './edit-custom-price-dialog'

type SubscriptionsTableProps = {
  subscriptions: UniversitySubscriptionItem[]
}

function getStatusBadgeVariant(
  status: UniversitySubscriptionItem['subscriptionStatus'],
): 'success' | 'warning' | 'destructive' {
  switch (status) {
    case 'ACTIVE':
      return 'success'
    case 'PENDING_CANCELLATION':
      return 'warning'
    case 'CANCELLED':
      return 'destructive'
    default:
      return 'success'
  }
}

function getStatusLabel(
  status: UniversitySubscriptionItem['subscriptionStatus'],
) {
  switch (status) {
    case 'ACTIVE':
      return 'Active'
    case 'PENDING_CANCELLATION':
      return 'Pending Cancel'
    case 'CANCELLED':
      return 'Cancelled'
  }
}

export function SubscriptionsTable({ subscriptions }: SubscriptionsTableProps) {
  const [selectedSubscription, setSelectedSubscription] =
    useState<UniversitySubscriptionItem | null>(null)

  return (
    <>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>University</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Active / Peak Seats</TableHead>
              <TableHead>Effective Rate</TableHead>
              <TableHead>Estimated Month</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.map((sub) => (
              <TableRow key={sub.universityId}>
                <TableCell>
                  <div className="space-y-1">
                    <Link
                      to="/super-admin/universities/$universityId"
                      params={{ universityId: sub.universityId }}
                      className="font-medium text-foreground leading-tight hover:text-primary hover:underline text-left cursor-pointer transition-colors block"
                    >
                      {sub.universityName}
                    </Link>
                    <div className="text-xs text-muted-foreground font-mono leading-tight">
                      {sub.universityCode}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge
                    status={sub.subscriptionStatus}
                    tone={getStatusBadgeVariant(sub.subscriptionStatus)}
                    label={getStatusLabel(sub.subscriptionStatus)}
                  />
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3" />
                      <span>Active: {sub.currentStudentsCount}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-foreground">
                      <TrendingUp className="size-3 text-primary" />
                      <span>Peak: {sub.peakStudentsCount}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">
                        ${sub.effectivePricePerSeat.toFixed(2)}
                      </span>
                      {sub.isCustomPrice ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-primary/10 text-primary font-medium"
                        >
                          Custom
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          (Default)
                        </span>
                      )}
                    </div>
                    {sub.hasNextPriceChange &&
                    sub.nextEffectivePricePerSeat !== null &&
                    sub.nextEffectivePricePerSeat !== undefined ? (
                      <span className="block text-[11px] font-medium text-primary">
                        Next: ${sub.nextEffectivePricePerSeat.toFixed(2)}/seat
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 font-bold text-foreground">
                    <DollarSign className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{sub.estimatedMonthlyTotal.toFixed(2)}</span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {sub.currency}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs"
                    aria-label={`Configure pricing for ${sub.universityName}`}
                    onClick={() => setSelectedSubscription(sub)}
                  >
                    <Edit2 className="size-3.5" />
                    Configure
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EditCustomPriceDialog
        subscription={selectedSubscription}
        open={selectedSubscription !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSubscription(null)
          }
        }}
      />
    </>
  )
}
