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
import { isApiError } from '@/features/auth/api/authenticated-api-client'
import { useUploadInstructorMaterial } from '@/features/instructor/hooks/use-instructor-materials'
import {
  createInstructorMaterialUploadSchema,
  formatFileSize,
} from '@/features/instructor/schemas/instructor-material.schema'
import type {
  InstructorMaterialUpload,
  InstructorMaterialUploadConfiguration,
} from '@/features/instructor/schemas/instructor-material.schema'
import { cn } from '@/lib/utils'

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export function MaterialUploadForm({
  courseId,
  configuration,
}: {
  courseId: string
  configuration: InstructorMaterialUploadConfiguration
}) {
  const uploadMutation = useUploadInstructorMaterial()
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  )
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const uploadSchema = useMemo(
    () => createInstructorMaterialUploadSchema(configuration.maxUploadBytes),
    [configuration.maxUploadBytes],
  )

  const form = useForm<InstructorMaterialUpload>({
    resolver: zodResolver(uploadSchema),
    mode: 'onChange',
    defaultValues: {
      title: '',
      file: undefined,
    },
  })

  const clearProgressTimers = () => {
    if (progressIntervalRef.current !== null) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    if (successTimeoutRef.current !== null) {
      clearTimeout(successTimeoutRef.current)
      successTimeoutRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current !== null) {
        clearInterval(progressIntervalRef.current)
      }
      if (successTimeoutRef.current !== null) {
        clearTimeout(successTimeoutRef.current)
      }
    }
  }, [])

  const startProgress = () => {
    clearProgressTimers()

    let current = 5
    setProgress(current)

    progressIntervalRef.current = setInterval(() => {
      current = Math.min(current + Math.floor(Math.random() * 15) + 8, 95)
      setProgress(current)
      if (current >= 95 && progressIntervalRef.current !== null) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    }, 150)
  }

  const handleSubmit = async ({ title, file }: InstructorMaterialUpload) => {
    setErrorMessage(null)
    setStatus('uploading')
    setProgress(0)

    try {
      startProgress()

      await uploadMutation.mutateAsync({
        courseId,
        title,
        file,
      })

      clearProgressTimers()
      setProgress(100)
      successTimeoutRef.current = setTimeout(() => {
        successTimeoutRef.current = null
        setStatus('success')
      }, 300)
    } catch (error) {
      clearProgressTimers()
      setStatus('error')
      setErrorMessage(
        isApiError(error)
          ? error.message
          : 'Unable to upload this PDF. Please verify the file and try again.',
      )
    }
  }

  const handleReset = () => {
    clearProgressTimers()
    form.reset({ title: '', file: undefined })
    setSelectedFile(null)
    setStatus('idle')
    setProgress(0)
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

  return (
    <Form {...form}>
      <form
        className="grid gap-5 w-full min-w-0 max-w-full overflow-hidden"
        noValidate
        onSubmit={(event) => void form.handleSubmit(handleSubmit)(event)}
      >
        {status === 'idle' ? (
          <>
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
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      'relative flex w-full min-w-0 max-w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 sm:p-5 text-center transition-all overflow-hidden',
                      dragActive
                        ? 'border-primary bg-primary/5'
                        : selectedFile
                          ? 'border-border bg-card'
                          : 'border-border/80 bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/60',
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
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                          <UploadCloudIcon className="size-6" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Click or drag PDF file here
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Maximum{' '}
                            {formatFileSize(configuration.maxUploadBytes)}
                          </p>
                        </div>
                      </div>
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
              <Loader2Icon className="size-7 animate-spin" />
            </div>
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">
                  Uploading {selectedFile?.name ?? 'PDF'}…
                </span>
                <span className="font-mono font-bold text-primary">
                  {progress}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-200 ease-out rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                Parsing course pages and preparing vector index…
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
