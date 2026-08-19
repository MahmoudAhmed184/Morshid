import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  FileTextIcon,
  Loader2Icon,
  RotateCcwIcon,
  UploadCloudIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
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
import { isApiError } from '@/features/auth/session/interface/authenticated-api-client'
import { useUploadCourseMaterial } from '@/workspaces/instructor/materials/use-materials'
import {
  createMaterialUploadSchema,
  formatFileSize,
} from '@/features/materials/material-ingestion/material.schema'
import type {
  MaterialUpload,
  MaterialUploadConfiguration,
} from '@/features/materials/material-ingestion/material.schema'
import { cn } from '@/lib/utils'

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export interface MaterialUploadCourseOption {
  id: string
  code: string
  title: string
}

export function MaterialUploadForm({
  courses = [],
  courseId,
  defaultCourseId,
  configuration,
  onUploadSuccess,
}: {
  courses?: MaterialUploadCourseOption[]
  courseId?: string
  defaultCourseId?: string
  configuration: MaterialUploadConfiguration
  onUploadSuccess?: (courseId: string) => void
}) {
  const uploadMutation = useUploadCourseMaterial()
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [dragActive, setDragActive] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const normalizedCourses = useMemo(() => {
    if (courses.length > 0) {
      return courses
    }
    if (courseId) {
      return [{ id: courseId, code: 'Assigned', title: 'Course' }]
    }
    return []
  }, [courses, courseId])

  const initialCourseId =
    defaultCourseId &&
    normalizedCourses.some((course) => course.id === defaultCourseId)
      ? defaultCourseId
      : courseId && normalizedCourses.some((course) => course.id === courseId)
        ? courseId
        : (normalizedCourses[0]?.id ?? '')

  const courseSelectItems = useMemo(
    () =>
      normalizedCourses.map((course) => ({
        label: course.title ? `${course.code} — ${course.title}` : course.code,
        value: course.id,
      })),
    [normalizedCourses],
  )

  const uploadSchema = useMemo(
    () => createMaterialUploadSchema(configuration.maxUploadBytes),
    [configuration.maxUploadBytes],
  )

  const form = useForm<MaterialUpload>({
    resolver: zodResolver(uploadSchema),
    mode: 'onChange',
    defaultValues: {
      courseId: initialCourseId,
      title: '',
      file: undefined,
    },
  })

  useEffect(() => {
    if (status === 'idle' && !form.formState.isDirty) {
      form.setValue('courseId', initialCourseId)
    }
  }, [form, initialCourseId, status])

  const handleSubmit = async ({
    courseId: targetCourseId,
    title,
    file,
  }: MaterialUpload) => {
    setErrorMessage(null)
    setStatus('uploading')

    try {
      await uploadMutation.mutateAsync({
        courseId: targetCourseId,
        title,
        file,
      })

      setStatus('success')
      onUploadSuccess?.(targetCourseId)
    } catch (error) {
      setStatus('error')
      setErrorMessage(
        isApiError(error)
          ? error.message
          : 'Unable to upload this PDF. Please verify the file and try again.',
      )
    }
  }

  const handleReset = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    form.reset({
      courseId: initialCourseId,
      title: '',
      file: undefined,
    })
    setSelectedFile(null)
    setStatus('idle')
    setErrorMessage(null)
  }

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true)
    } else if (event.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)

    const file = event.dataTransfer.files.item(0)
    if (file) {
      form.setValue('file', file, { shouldValidate: true })
      setSelectedFile(file)
      if (!form.getValues('title')) {
        const titleFromFilename = file.name.replace(/\.[^/.]+$/, '')
        form.setValue('title', titleFromFilename, { shouldValidate: true })
      }
    }
  }

  const selectedFileName = selectedFile?.name ?? 'PDF'
  const politeAnnouncement =
    status === 'uploading'
      ? `Uploading ${selectedFileName}. This may take a moment.`
      : status === 'success'
        ? `Upload complete. ${selectedFileName} is queued for course-material processing.`
        : ''
  const assertiveAnnouncement =
    status === 'error'
      ? `Upload failed. ${errorMessage ?? 'An error occurred during file upload.'}`
      : ''

  return (
    <Form {...form}>
      <form
        className="grid gap-5 w-full min-w-0 max-w-full overflow-hidden"
        noValidate
        onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}
      >
        {/*
          Live regions stay mounted for the whole form lifetime. Assistive
          technology only reliably announces a region that already existed when
          its text changed, so the status screens below are presentational.
        */}
        <div role="status" aria-live="polite" className="sr-only">
          {politeAnnouncement}
        </div>
        <div role="alert" className="sr-only">
          {assertiveAnnouncement}
        </div>

        {status === 'idle' ? (
          <>
            <FormField
              control={form.control}
              name="courseId"
              render={({ field }) => (
                <FormItem className="w-full min-w-0">
                  <FormLabel>Course</FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={(value) => {
                      field.onChange(value ?? '')
                    }}
                    items={courseSelectItems}
                  >
                    <FormControl>
                      <SelectTrigger
                        className="w-full truncate"
                        aria-label="Course"
                      >
                        <SelectValue placeholder="Select a course" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {courseSelectItems.map((course) => (
                        <SelectItem key={course.value} value={course.value}>
                          {course.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="w-full min-w-0">
                  <FormLabel>Material title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Week 2 lecture notes"
                      className="w-full min-w-0 truncate"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="file"
              render={({ field: { onChange, onBlur, name } }) => (
                <FormItem className="w-full min-w-0">
                  <FormLabel>PDF file</FormLabel>
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={cn(
                      'relative flex w-full min-w-0 max-w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-4 text-center transition-all motion-reduce:transition-none sm:p-5',
                      // The native input is visually hidden but stays in the
                      // tab order, so surface its focus ring on the drop zone.
                      'has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring/60',
                      dragActive
                        ? 'border-primary bg-primary/5'
                        : selectedFile
                          ? 'border-border bg-card'
                          : 'border-border/80 bg-muted/30',
                    )}
                  >
                    <FormControl>
                      <input
                        ref={fileInputRef}
                        name={name}
                        type="file"
                        accept={`${configuration.acceptedFileExtension},${configuration.acceptedMimeType}`}
                        className="sr-only"
                        onBlur={onBlur}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) {
                            onChange(file)
                            setSelectedFile(file)
                            if (!form.getValues('title')) {
                              const titleFromFilename = file.name.replace(
                                /\.[^/.]+$/,
                                '',
                              )
                              form.setValue('title', titleFromFilename, {
                                shouldValidate: true,
                              })
                            }
                          }
                        }}
                      />
                    </FormControl>

                    {selectedFile ? (
                      <div className="flex w-full min-w-0 max-w-full items-center justify-between gap-3 overflow-hidden">
                        <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <FileTextIcon className="size-5" />
                          </div>
                          <div className="text-left min-w-0 flex-1 overflow-hidden">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {selectedFile.name}
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {formatFileSize(selectedFile.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            form.resetField('file')
                            setSelectedFile(null)
                            if (fileInputRef.current) {
                              fileInputRef.current.value = ''
                            }
                          }}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          aria-label={`Remove ${selectedFile.name}`}
                        >
                          <XIcon className="size-4" aria-hidden />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                        aria-label="Choose PDF file"
                      >
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                          <UploadCloudIcon className="size-6" aria-hidden />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Choose or drag PDF file here
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Maximum{' '}
                            {formatFileSize(configuration.maxUploadBytes)}
                          </p>
                        </div>
                      </button>
                    )}
                  </div>
                  <FormDescription className="sr-only">
                    PDF only. Maximum{' '}
                    {formatFileSize(configuration.maxUploadBytes)}.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={!form.formState.isValid || !selectedFile}
              className="w-full h-11 rounded-xl gap-2 text-base font-semibold"
            >
              <UploadIcon className="size-4" aria-hidden />
              Upload PDF
            </Button>
          </>
        ) : null}

        {status === 'uploading' ? (
          <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
            <div className="relative flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2Icon className="size-7 animate-spin" aria-hidden />
            </div>
            <div className="w-full space-y-2">
              <p className="font-medium text-foreground">
                Uploading {selectedFile?.name ?? 'PDF'}…
              </p>
              <div
                role="progressbar"
                aria-label="PDF upload in progress"
                className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full w-1/3 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                The file will be queued for course-material processing.
              </p>
            </div>
          </div>
        ) : null}

        {status === 'success' ? (
          <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2Icon className="size-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">
                Upload Complete!
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                PDF uploaded and queued for processing and Socratic citations.
              </p>
            </div>
            <div className="flex w-full gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="flex-1 rounded-xl h-11"
              >
                Upload another
              </Button>
            </div>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <AlertCircleIcon className="size-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">
                Upload Failed
              </h3>
              <p className="text-sm text-destructive max-w-xs mx-auto">
                {errorMessage ?? 'An error occurred during file upload.'}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="w-full rounded-xl h-11 gap-2 mt-2"
            >
              <RotateCcwIcon className="size-4" />
              Try again
            </Button>
          </div>
        ) : null}
      </form>
    </Form>
  )
}
