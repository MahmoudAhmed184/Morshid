import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CopyIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  Loader2Icon,
  UploadIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import { useId, useRef, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { resolveCourseMembers } from '@/features/courses/course-administration.api'
import type {
  CourseAdministration,
  CourseMembershipRole,
  ResolveCourseMembersResponse,
  ResolvedCourseMember,
} from '@/features/courses/course-administration.schema'

import {
  downloadBulkAssignmentTemplate,
  parseCsvEmails,
  parsePastedEmails,
} from './bulk-assignment-parser'

type BulkUserImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: CourseMembershipRole
  selectedCourseIds: Set<string>
  courses: CourseAdministration[]
  maxUserSelections: number
  currentSelectedCount?: number
  onApply: (resolvedUsers: ResolvedCourseMember[]) => void
}

export function BulkUserImportDialog({
  open,
  onOpenChange,
  role,
  selectedCourseIds,
  courses,
  maxUserSelections,
  currentSelectedCount: _currentSelectedCount,
  onApply,
}: BulkUserImportDialogProps) {
  const [activeTab, setActiveTab] = useState<'paste' | 'csv'>('paste')
  const [pastedText, setPastedText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [parsedCsvEmails, setParsedCsvEmails] = useState<string[]>([])
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [isResolving, setIsResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [resolution, setResolution] =
    useState<ResolveCourseMembersResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pasteTextareaId = useId()
  const csvFileInputId = useId()

  const userLabel = role === 'STUDENT' ? 'students' : 'instructors'
  const singularUserLabel = role === 'STUDENT' ? 'student' : 'instructor'

  const resetState = () => {
    setPastedText('')
    setSelectedFile(null)
    setParsedCsvEmails([])
    setCsvErrors([])
    setIsResolving(false)
    setResolveError(null)
    setResolution(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetState()
    onOpenChange(nextOpen)
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setResolveError(null)
    const result = await parseCsvEmails(file)
    setParsedCsvEmails(result.emails)
    setCsvErrors(result.errors)
    if (result.emails.length > 0) {
      await resolveEmails(result.emails)
    }
  }

  async function resolveEmails(
    emails: string[],
    invalidIdentifiers: string[] = [],
  ) {
    const identifierCount = emails.length + invalidIdentifiers.length

    if (identifierCount === 0) {
      setResolveError('Please enter at least one email address.')
      return
    }

    if (identifierCount > 1_000) {
      setResolveError(
        'A single bulk assignment can resolve at most 1,000 email addresses.',
      )
      return
    }

    if (emails.length === 0) {
      setResolution({
        resolved: [],
        unmatched: invalidIdentifiers,
        duplicates: [],
      })
      return
    }

    try {
      setIsResolving(true)
      setResolveError(null)
      const result = await resolveCourseMembers({
        identifiers: emails,
        role,
        courseIds: [...selectedCourseIds],
      })
      setResolution({
        ...result,
        unmatched: [...result.unmatched, ...invalidIdentifiers],
      })
    } catch (error) {
      setResolveError(
        error instanceof Error
          ? error.message
          : `Failed to resolve ${userLabel}. Please try again.`,
      )
    } finally {
      setIsResolving(false)
    }
  }

  const handleResolve = () => {
    const emails = parsePastedEmails(pastedText)
    const emailSet = new Set(emails)
    const invalidIdentifiers = pastedText
      .split(/[\r\n,;\t]+/)
      .map((identifier) => identifier.trim())
      .filter((identifier) => identifier && !emailSet.has(identifier))
    void resolveEmails(emails, invalidIdentifiers)
  }

  const handleApply = () => {
    const availableUsers =
      resolution?.resolved.filter(
        (user) => user.alreadyAssignedCourseIds.length === 0,
      ) ?? []
    if (availableUsers.length === 0) return
    onApply(availableUsers)
    handleOpenChange(false)
  }

  const removeIdentifier = (identifier: string) => {
    setResolution((current) => {
      if (!current) return current
      return {
        resolved: current.resolved.filter((user) => user.email !== identifier),
        unmatched: current.unmatched.filter((value) => value !== identifier),
        duplicates: current.duplicates.filter((value) => value !== identifier),
      }
    })
  }

  const courseNamesById = new Map(courses.map((c) => [c.id, c.code]))
  const alreadyAssignedCount =
    resolution?.resolved.filter((u) => u.alreadyAssignedCourseIds.length > 0)
      .length ?? 0
  const availableUsers =
    resolution?.resolved.filter(
      (user) => user.alreadyAssignedCourseIds.length === 0,
    ) ?? []
  const wouldExceedLimit = availableUsers.length > maxUserSelections

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[min(88vh,780px)] w-[min(94vw,900px)] max-w-none flex-col gap-4 overflow-hidden p-5 sm:max-w-none sm:p-6">
        <DialogHeader className="shrink-0 pr-10">
          <DialogTitle>Bulk select and import {userLabel}</DialogTitle>
          <DialogDescription>
            Import {userLabel} by email via pasted text or CSV file. Email
            addresses will be verified before selection.
          </DialogDescription>
        </DialogHeader>

        {resolveError ? (
          <Alert variant="destructive" className="shrink-0">
            <AlertCircleIcon className="size-4" />
            <AlertDescription>{resolveError}</AlertDescription>
          </Alert>
        ) : null}

        {!resolution ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <Tabs
              value={activeTab}
              onValueChange={(val) => {
                setActiveTab(val as 'paste' | 'csv')
                setResolveError(null)
              }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="paste" className="gap-2">
                  <CopyIcon className="size-4" /> Paste email addresses
                </TabsTrigger>
                <TabsTrigger value="csv" className="gap-2">
                  <FileSpreadsheetIcon className="size-4" /> Upload CSV
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="paste"
                className="mt-3 flex min-h-0 flex-1 flex-col gap-2"
              >
                <label
                  htmlFor={pasteTextareaId}
                  className="text-xs text-muted-foreground"
                >
                  Enter email addresses separated by newlines, commas, or tabs:
                </label>
                <Textarea
                  id={pasteTextareaId}
                  value={pastedText}
                  onChange={(e) => {
                    setPastedText(e.target.value)
                    setResolveError(null)
                  }}
                  placeholder={`${singularUserLabel}1@morshid.demo\n${singularUserLabel}2@morshid.demo`}
                  className="min-h-[220px] flex-1 resize-none font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Tip: You can copy and paste entire columns from Excel or
                  Google Sheets.
                </p>
              </TabsContent>

              <TabsContent
                value="csv"
                className="mt-3 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
              >
                <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3">
                  <div className="text-xs text-muted-foreground">
                    Need a starter format? Download a ready CSV template.
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadBulkAssignmentTemplate(role)}
                  >
                    <DownloadIcon className="size-3.5" /> Template
                  </Button>
                </div>

                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center">
                  <UploadIcon className="mb-2 size-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Select a CSV file</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    File must contain an &ldquo;email&rdquo; column.
                  </p>
                  <label
                    htmlFor={csvFileInputId}
                    className="mt-4 inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Choose CSV file
                  </label>
                  <input
                    ref={fileInputRef}
                    id={csvFileInputId}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => void handleFileChange(e)}
                    className="sr-only"
                  />
                  {selectedFile ? (
                    <div className="mt-3 text-xs text-foreground">
                      Selected: <strong>{selectedFile.name}</strong> (
                      {parsedCsvEmails.length} email address
                      {parsedCsvEmails.length === 1 ? '' : 'es'} parsed)
                    </div>
                  ) : null}
                </div>

                {csvErrors.length > 0 ? (
                  <Alert variant="destructive">
                    <AlertCircleIcon className="size-4" />
                    <AlertDescription>
                      <ul className="list-inside list-disc text-xs">
                        {csvErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                ) : null}
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          /* Resolution Preview Panel */
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs text-muted-foreground">Matched</div>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {resolution.resolved.length}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Valid active {userLabel}
                </div>
              </div>

              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs text-muted-foreground">
                  Already in Course
                </div>
                <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  {alreadyAssignedCount}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Not added to selection
                </div>
              </div>

              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs text-muted-foreground">Unmatched</div>
                <div className="text-xl font-bold text-destructive">
                  {resolution.unmatched.length}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Not found / wrong role
                </div>
              </div>

              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs text-muted-foreground">Duplicates</div>
                <div className="text-xl font-bold text-muted-foreground">
                  {resolution.duplicates.length}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Deduplicated in input
                </div>
              </div>
            </div>

            {wouldExceedLimit ? (
              <Alert variant="destructive">
                <AlertCircleIcon className="size-4" />
                <AlertDescription>
                  The available list contains {availableUsers.length} users,
                  which exceeds the selection limit of {maxUserSelections} for
                  the chosen courses. Please reduce the number of users or
                  courses.
                </AlertDescription>
              </Alert>
            ) : null}

            {/* Resolved Users & Issues Details */}
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-muted/10 p-3">
              <div className="flex flex-col gap-3">
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-foreground">
                    Matched {userLabel} ({resolution.resolved.length})
                  </h4>
                  {resolution.resolved.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No matching active {userLabel} found.
                    </p>
                  ) : (
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {resolution.resolved.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">
                              {user.displayName}
                            </div>
                            <div className="text-muted-foreground truncate">
                              {user.email}
                            </div>
                          </div>
                          {user.alreadyAssignedCourseIds.length > 0 ? (
                            <Badge
                              variant="outline"
                              className="shrink-0 text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10"
                            >
                              In{' '}
                              {user.alreadyAssignedCourseIds
                                .map(
                                  (id) => courseNamesById.get(id) ?? 'course',
                                )
                                .join(', ')}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="shrink-0 text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                            >
                              Ready
                            </Badge>
                          )}
                          <button
                            type="button"
                            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                            aria-label={`Remove ${user.email}`}
                            onClick={() => removeIdentifier(user.email)}
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {resolution.unmatched.length > 0 ? (
                  <div className="border-t pt-2">
                    <h4 className="mb-1 text-xs font-semibold text-destructive">
                      Unmatched Identifiers ({resolution.unmatched.length})
                    </h4>
                    <p className="mb-2 text-[11px] text-muted-foreground">
                      These email addresses did not match any active{' '}
                      {singularUserLabel} in Morshid.
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {resolution.unmatched.map((ident, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 font-mono text-[11px] text-destructive"
                        >
                          {ident}
                          <button
                            type="button"
                            className="rounded text-destructive/70 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                            aria-label={`Remove ${ident}`}
                            onClick={() => removeIdentifier(ident)}
                          >
                            <XIcon className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {resolution.duplicates.length > 0 ? (
                  <div className="border-t pt-2">
                    <h4 className="mb-1 text-xs font-semibold text-muted-foreground">
                      Duplicate Identifiers ({resolution.duplicates.length})
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {resolution.duplicates.map((ident, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 font-mono text-[11px] text-muted-foreground"
                        >
                          {ident}
                          <button
                            type="button"
                            className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                            aria-label={`Remove ${ident}`}
                            onClick={() => removeIdentifier(ident)}
                          >
                            <XIcon className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 items-center border-t pt-4 sm:justify-between">
          {!resolution ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              {activeTab === 'paste' ? (
                <Button
                  type="button"
                  disabled={isResolving || !pastedText.trim()}
                  onClick={handleResolve}
                >
                  {isResolving ? (
                    <Loader2Icon className="animate-spin size-4" />
                  ) : (
                    <UsersIcon className="size-4" />
                  )}
                  {isResolving ? 'Resolving…' : `Resolve ${userLabel}`}
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResolution(null)}
              >
                Back to import
              </Button>
              <Button
                type="button"
                disabled={availableUsers.length === 0 || wouldExceedLimit}
                onClick={handleApply}
              >
                <CheckCircle2Icon className="size-4" />
                Add {availableUsers.length} {userLabel} to selection
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
