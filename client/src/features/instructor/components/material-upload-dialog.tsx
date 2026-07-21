import { UploadIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { MaterialUploadForm } from '@/features/instructor/components/material-upload-form'

export function MaterialUploadDialog({ courseId }: { courseId: string }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button className="w-full sm:w-auto" />}>
        <UploadIcon aria-hidden />
        Upload Material
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload new material</DialogTitle>
          <DialogDescription>
            Add a clean, text-based PDF to the selected course.
          </DialogDescription>
        </DialogHeader>
        <MaterialUploadForm courseId={courseId} />
      </DialogContent>
    </Dialog>
  )
}
