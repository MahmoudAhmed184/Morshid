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

export interface MaterialUploadCourseOption {
  id: string
  code: string
  title: string
}

export function MaterialUploadDialog({
  courses,
  defaultCourseId,
  configuration,
  onUploadSuccess,
}: {
  courses: MaterialUploadCourseOption[]
  defaultCourseId?: string
  configuration: MaterialUploadConfiguration
  onUploadSuccess?: (courseId: string) => void
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button className="w-full sm:w-auto shrink-0" />}>
        <UploadIcon aria-hidden />
        Upload Material
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload new material</DialogTitle>
          <DialogDescription>
            Add a clean, text-based PDF to an assigned course.
          </DialogDescription>
        </DialogHeader>
        <MaterialUploadForm
          courses={courses}
          defaultCourseId={defaultCourseId}
          configuration={configuration}
          onUploadSuccess={onUploadSuccess}
        />
      </DialogContent>
    </Dialog>
  )
}
