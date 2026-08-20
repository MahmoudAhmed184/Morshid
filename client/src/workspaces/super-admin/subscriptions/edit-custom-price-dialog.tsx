import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  updateCustomPriceFormSchema,
  useUpdateUniversitySubscriptionMutation,
} from '@/features/subscriptions/interface'
import type {
  UniversitySubscriptionItem,
  UpdateCustomPriceFormValues,
} from '@/features/subscriptions/interface'

type EditCustomPriceDialogProps = {
  subscription: UniversitySubscriptionItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditCustomPriceDialog({
  subscription,
  open,
  onOpenChange,
}: EditCustomPriceDialogProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const updateMutation = useUpdateUniversitySubscriptionMutation()

  const form = useForm<UpdateCustomPriceFormValues>({
    resolver: zodResolver(updateCustomPriceFormSchema),
    defaultValues: {
      customPricePerSeat: subscription?.customPricePerSeat ?? null,
      status: subscription?.subscriptionStatus ?? 'ACTIVE',
    },
  })

  const enteredPrice = useWatch({
    control: form.control,
    name: 'customPricePerSeat',
  })

  useEffect(() => {
    if (subscription && open) {
      form.reset({
        customPricePerSeat: subscription.customPricePerSeat,
        status: subscription.subscriptionStatus,
      })
    }
  }, [form, open, subscription])

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setErrorMessage(null)
    }
  }

  if (!subscription) {
    return null
  }

  const effectivePrice =
    typeof enteredPrice === 'number' &&
    !Number.isNaN(enteredPrice) &&
    enteredPrice >= 0
      ? enteredPrice
      : subscription.defaultPricePerSeat
  const estimatedBill = subscription.peakStudentsCount * effectivePrice

  const onSubmit = async (values: UpdateCustomPriceFormValues) => {
    setErrorMessage(null)
    try {
      const customPrice =
        typeof values.customPricePerSeat === 'number' &&
        !Number.isNaN(values.customPricePerSeat)
          ? values.customPricePerSeat
          : null

      await updateMutation.mutateAsync({
        universityId: subscription.universityId,
        input: {
          customPricePerSeat: customPrice,
          status: values.status,
          cancelAtPeriodEnd: values.status === 'PENDING_CANCELLATION',
        },
      })
      handleOpenChange(false)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Failed to update custom subscription pricing.',
      )
    }
  }

  const isSubmitting = updateMutation.isPending || form.formState.isSubmitting

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configure University Subscription</DialogTitle>
          <DialogDescription className="text-xs">
            Manage custom per-seat pricing and subscription lifecycle for{' '}
            <strong className="font-semibold text-foreground">
              {subscription.universityName}
            </strong>{' '}
            <span className="font-mono text-[11px] text-muted-foreground">
              ({subscription.universityCode})
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {/* Compact Metrics Bar */}
        <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/40 p-2.5">
          <div className="rounded-lg bg-background/80 p-2 border">
            <span className="block text-[11px] font-medium text-muted-foreground">
              Active / Peak Seats
            </span>
            <span className="text-sm font-semibold text-foreground">
              {subscription.currentStudentsCount}{' '}
              <span className="text-xs font-normal text-muted-foreground">
                / {subscription.peakStudentsCount}
              </span>
            </span>
          </div>
          <div className="rounded-lg bg-background/80 p-2 border">
            <span className="block text-[11px] font-medium text-muted-foreground">
              Standard Rate
            </span>
            <span className="text-sm font-semibold text-foreground">
              ${subscription.defaultPricePerSeat.toFixed(2)}
              <span className="text-xs font-normal text-muted-foreground">
                /mo
              </span>
            </span>
          </div>
          <div className="rounded-lg bg-background/80 p-2 border">
            <span className="block text-[11px] font-medium text-muted-foreground">
              Est. Monthly Total
            </span>
            <span className="text-sm font-bold text-foreground">
              ${estimatedBill.toFixed(2)}{' '}
              <span className="text-[10px] font-normal text-muted-foreground">
                {subscription.currency}
              </span>
            </span>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="customPricePerSeat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Custom Rate / Seat</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-sm font-medium text-muted-foreground">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="ps-7 text-xs h-9 font-medium"
                          placeholder={`${subscription.defaultPricePerSeat.toFixed(2)} (Standard)`}
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ''
                                ? null
                                : Number(e.target.value),
                            )
                          }
                        />
                      </div>
                    </FormControl>
                    <FormDescription className="text-[11px] leading-tight">
                      Leave empty to use default rate (${subscription.defaultPricePerSeat.toFixed(2)}).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Subscription Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full h-9 text-xs">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="PENDING_CANCELLATION">
                          Pending Cancellation
                        </SelectItem>
                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-[11px] leading-tight">
                      Access stays active until billing cycle ends if pending.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2 pt-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
