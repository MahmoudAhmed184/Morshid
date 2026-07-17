import { useId, useState } from 'react'
import { Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ChatSession } from '@/features/student/schemas/student-chat.schema'

interface StudentRenameSessionDialogProps {
  session: ChatSession
  isPending: boolean
  onRename: (title: string) => Promise<void>
}

export function StudentRenameSessionDialog({
  session,
  isPending,
  onRename,
}: StudentRenameSessionDialogProps) {
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(session.title)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const trimmedTitle = title.trim()
  const canSubmit =
    trimmedTitle.length > 0 &&
    trimmedTitle.length <= 160 &&
    trimmedTitle !== session.title

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    setTitle(session.title)
    setErrorMessage(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!canSubmit || isPending) {
      return
    }

    setErrorMessage(null)

    try {
      await onRename(trimmedTitle)
      handleOpenChange(false)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to rename this conversation.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isPending}
            aria-label={`Rename ${session.title}`}
          />
        }
      >
        <Pencil aria-hidden />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename conversation</DialogTitle>
          <DialogDescription>
            Choose a short title that helps you identify this course discussion.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={inputId}>Conversation title</Label>
            <Input
              id={inputId}
              value={title}
              maxLength={160}
              autoComplete="off"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          {errorMessage ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isPending}>
              {isPending ? 'Saving…' : 'Save title'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
