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
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia
            className={
              destructive
                ? 'bg-destructive/10 text-destructive'
                : 'text-muted-foreground'
            }
          >
            <TriangleAlertIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>

        {confirmInput ? (
          <div className="grid gap-2">
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
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isConfirming}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            disabled={confirmIsDisabled}
            onClick={() => void handleConfirm()}
          >
            {isConfirming ? 'Working...' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
