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
import { MaterialUploadForm } from '@/workspaces/instructor/materials/material-upload-form'
import type { MaterialUploadConfiguration } from '@/features/materials/material-ingestion/material.schema'

export function MaterialUploadDialog({
  courseId,
  configuration,
}: {
  courseId: string
  configuration: MaterialUploadConfiguration
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="lg" className="w-full sm:w-auto" />}>
        <UploadIcon aria-hidden />
        Upload Material
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload new material</DialogTitle>
          <DialogDescription>
            Add a clean, text-based PDF to the selected course.
          </DialogDescription>
        </DialogHeader>
        <MaterialUploadForm courseId={courseId} configuration={configuration} />
      </DialogContent>
    </Dialog>
  )
}
