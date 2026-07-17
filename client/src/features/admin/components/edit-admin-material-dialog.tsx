import { PencilIcon } from 'lucide-react'
import { useState } from 'react'

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
import type { AdminMaterial } from '@/features/admin/schemas/admin-course.schema'

type EditAdminMaterialDialogProps = {
  material: AdminMaterial
  isPending: boolean
  onSave: (title: string) => Promise<unknown>
}

export function EditAdminMaterialDialog({
  material,
  isPending,
  onSave,
}: EditAdminMaterialDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(material.title)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    setTitle(material.title)
    setErrorMessage(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextTitle = title.trim()
    if (!nextTitle) return

    try {
      await onSave(nextTitle)
      handleOpenChange(false)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to update this material.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Edit material" />
        }
      >
        <PencilIcon />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit material metadata</DialogTitle>
          <DialogDescription>
            Update the display title for {material.originalFilename}.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`material-title-${material.id}`}>Title</Label>
            <Input
              id={`material-title-${material.id}`}
              value={title}
              maxLength={180}
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
            <Button type="submit" disabled={!title.trim() || isPending}>
              {isPending ? 'Saving...' : 'Save title'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
