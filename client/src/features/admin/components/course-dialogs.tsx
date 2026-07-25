import { BookOpenIcon, BookPlusIcon, PencilIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AdminCourseForm } from './admin-course-form'
import type { AdminCourseFormValues } from './admin-course-form'
import type { AdminCourse } from '@/features/admin/schemas/admin-course.schema'

type CreateAdminCourseDialogProps = {
  onCreateCourse: (values: AdminCourseFormValues) => Promise<unknown>
}

export function CreateAdminCourseDialog({
  onCreateCourse,
}: CreateAdminCourseDialogProps) {
  const [open, setOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const handleOpenChange = (nextOpen: boolean) => {
    setErrorMessage(null)
    setOpen(nextOpen)
  }

  const handleSubmit = async (values: AdminCourseFormValues) => {
    try {
      setErrorMessage(null)
      await onCreateCourse(values)
      handleOpenChange(false)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to create course.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <BookPlusIcon />
        Create Course
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BookOpenIcon className="size-5" aria-hidden />
          </span>
          <DialogTitle>Create Course</DialogTitle>
          <DialogDescription>
            Add a new course code and title to the academic catalog.
          </DialogDescription>
        </DialogHeader>
        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        <AdminCourseForm
          onSubmit={handleSubmit}
          onCancel={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

type EditAdminCourseDialogProps = {
  course: AdminCourse
  onUpdateCourse: (values: AdminCourseFormValues) => Promise<unknown>
}

export function EditAdminCourseDialog({
  course,
  onUpdateCourse,
}: EditAdminCourseDialogProps) {
  const [open, setOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const handleOpenChange = (nextOpen: boolean) => {
    setErrorMessage(null)
    setOpen(nextOpen)
  }

  const handleSubmit = async (values: AdminCourseFormValues) => {
    try {
      setErrorMessage(null)
      await onUpdateCourse(values)
      handleOpenChange(false)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to update course.',
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
            aria-label={`Edit course ${course.code}`}
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        <PencilIcon className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PencilIcon className="size-5" aria-hidden />
          </span>
          <DialogTitle>Update Course</DialogTitle>
          <DialogDescription>
            Update course code and title for {course.code} — {course.title}.
          </DialogDescription>
        </DialogHeader>
        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        <AdminCourseForm
          isEditing
          initialValues={{
            code: course.code,
            title: course.title,
          }}
          onSubmit={handleSubmit}
          onCancel={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
