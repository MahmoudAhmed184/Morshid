import { useId, useState } from 'react'
import { TriangleAlertIcon } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type ConfirmInput = {
  value: string
  label?: string
  placeholder?: string
}

type ConfirmDialogProps = {
  trigger?: React.ReactElement
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  confirmInput?: ConfirmInput
  destructive?: boolean
  disabled?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onConfirm: () => void | Promise<void>
}

/*
Usage:
<ConfirmDialog
  trigger={<Button variant="destructive">Delete</Button>}
  title="Delete course?"
  description="This action cannot be undone."
  confirmLabel="Delete"
  confirmInput={{ value: 'DELETE' }}
  onConfirm={deleteCourse}
/>
*/
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmInput,
  destructive = true,
  disabled = false,
  open,
  onOpenChange,
  onConfirm,
}: ConfirmDialogProps) {
  const inputId = useId()
  const [internalOpen, setInternalOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isOpen = open ?? internalOpen
  const inputMatches = confirmInput
    ? inputValue.trim() === confirmInput.value
    : true
  const confirmIsDisabled = disabled || isConfirming || !inputMatches

  const setOpen = (nextOpen: boolean) => {
    if (!nextOpen) {
      setInputValue('')
    }

    setErrorMessage(null)

    onOpenChange?.(nextOpen)
    setInternalOpen(nextOpen)
  }

  const handleConfirm = async () => {
    if (confirmIsDisabled) {
      return
    }

    try {
      setIsConfirming(true)
      await onConfirm()
      setOpen(false)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to complete this action. Please try again.',
      )
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <AlertDialogTrigger render={trigger} /> : null}
      <AlertDialogContent className="max-w-[calc(100%-2rem)] gap-5 rounded-2xl p-5 shadow-2xl sm:max-w-[420px] sm:p-6">
        <AlertDialogHeader className="flex flex-col gap-2 text-left">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full',
                destructive
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-primary/10 text-primary',
              )}
            >
              <TriangleAlertIcon className="size-5 stroke-[2.25]" />
            </span>
            <AlertDialogTitle className="min-w-0 pt-1 text-lg font-semibold tracking-tight text-foreground break-words [overflow-wrap:anywhere]">
              {title}
            </AlertDialogTitle>
          </div>
          {description ? (
            <AlertDialogDescription className="text-sm leading-6 text-muted-foreground break-words [overflow-wrap:anywhere]">
              {description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>

        {confirmInput ? (
          <div className="mt-3 grid gap-2">
            <Label htmlFor={inputId}>
              {confirmInput.label ?? `Type "${confirmInput.value}" to confirm`}
            </Label>
            <Input
              id={inputId}
              value={inputValue}
              placeholder={confirmInput.placeholder ?? confirmInput.value}
              autoComplete="off"
              onChange={(event) => setInputValue(event.target.value)}
            />
          </div>
        ) : null}

        {errorMessage ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <AlertDialogFooter className="flex flex-row items-center justify-end gap-2 pt-1">
          <AlertDialogCancel
            disabled={isConfirming}
            className="h-9 rounded-lg border border-input bg-background px-4 text-sm font-medium text-foreground shadow-2xs hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring/30"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            disabled={confirmIsDisabled}
            className={cn(
              'h-9 rounded-lg px-4 text-sm font-medium shadow-2xs',
              destructive &&
                'bg-[#c52222] text-white hover:bg-[#a81c1c] focus-visible:ring-destructive/30',
            )}
            onClick={() => void handleConfirm()}
          >
            {isConfirming ? 'Working...' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
