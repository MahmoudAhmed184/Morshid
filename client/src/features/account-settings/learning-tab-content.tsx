import { useEffect, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  Check,
  CheckCircle2,
  Info,
  Loader2,
  Sparkles,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { isApiError } from '@/features/auth/session/interface/authenticated-api-client'
import { cn } from '@/lib/utils'
import {
  ExplanationDetailLevel,
  getStudentTutoringPreferences,
  updateStudentTutoringPreferences,
} from './learning-preferences'

interface DetailLevelOption {
  value: ExplanationDetailLevel
  label: string
  tag?: string
  tagVariant?: 'default' | 'secondary' | 'outline'
  summary: string
  description: string
}

const detailLevelOptions: readonly DetailLevelOption[] = [
  {
    value: ExplanationDetailLevel.CONCISE,
    label: 'Concise',
    tag: 'Quick & focused',
    tagVariant: 'secondary',
    summary: 'Direct hints and minimal narrative',
    description:
      'Provides brief, focused feedback with minimal step-by-step elaboration. Best when you want rapid hints and immediate next steps.',
  },
  {
    value: ExplanationDetailLevel.STANDARD,
    label: 'Standard',
    tag: 'Default',
    tagVariant: 'default',
    summary: 'Balanced Socratic scaffolding',
    description:
      'Balanced explanations with steady contextual scaffolding. The recommended tutoring style for most learners.',
  },
  {
    value: ExplanationDetailLevel.DETAILED,
    label: 'Detailed',
    tag: 'In-depth',
    tagVariant: 'secondary',
    summary: 'Rich context and step breakdowns',
    description:
      'Comprehensive, multi-step breakdowns and rich conceptual explanations for deep learning and thorough problem analysis.',
  },
]

export function LearningTabContent() {
  const [initialLevel, setInitialLevel] =
    useState<ExplanationDetailLevel | null>(null)
  const [selectedLevel, setSelectedLevel] =
    useState<ExplanationDetailLevel | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadPreferences() {
      setIsLoading(true)
      setErrorMessage(null)
      try {
        const preferences = await getStudentTutoringPreferences()
        if (isMounted) {
          setInitialLevel(preferences.explanationDetailLevel)
          setSelectedLevel(preferences.explanationDetailLevel)
        }
      } catch (error) {
        if (isMounted) {
          const message = isApiError(error)
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Failed to load learning preferences.'
          setErrorMessage(message)
          // Default to STANDARD on error so the student can still interact
          setInitialLevel(ExplanationDetailLevel.STANDARD)
          setSelectedLevel(ExplanationDetailLevel.STANDARD)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadPreferences()

    return () => {
      isMounted = false
    }
  }, [])

  const isUnchanged = selectedLevel === initialLevel

  async function handleSave() {
    if (!selectedLevel || isUnchanged) {
      return
    }

    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const updated = await updateStudentTutoringPreferences({
        explanationDetailLevel: selectedLevel,
      })
      setInitialLevel(updated.explanationDetailLevel)
      setSelectedLevel(updated.explanationDetailLevel)
      setSuccessMessage('Learning preferences updated successfully.')
    } catch (error) {
      const message = isApiError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Failed to update learning preferences. Please try again.'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {successMessage ? (
        <Alert
          className="border-emerald-500/20 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2
            className="size-4 text-emerald-600 dark:text-emerald-400"
            aria-hidden
          />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" aria-hidden />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="relative -mx-4 overflow-hidden rounded-none border-x-0 py-0 sm:mx-0 sm:rounded-xl sm:border-x">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(ellipse_at_65%_100%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_65%)]"
          aria-hidden
        />
        <CardContent className="relative flex flex-col gap-6 px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-medium text-foreground">
              <BookOpen className="size-4 text-muted-foreground" aria-hidden />
              Explanation Detail
            </h2>
            <Badge variant="outline" className="gap-1 text-xs">
              <Sparkles className="size-3 text-primary" aria-hidden />
              Socratic Tutor
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            Choose the default depth and length of tutoring explanations.
            Morshid adapts how much context and reasoning detail is provided
            while preserving step-by-step guidance.
          </p>

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-3" aria-busy="true">
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
            </div>
          ) : (
            <div
              className="grid gap-3 sm:grid-cols-3"
              role="radiogroup"
              aria-label="Explanation detail level"
            >
              {detailLevelOptions.map((option) => {
                const isSelected = selectedLevel === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setSelectedLevel(option.value)
                      setSuccessMessage(null)
                    }}
                    className={cn(
                      'group relative flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm'
                        : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40',
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="font-medium text-sm text-foreground">
                        {option.label}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {option.tag ? (
                          <Badge
                            variant={option.tagVariant ?? 'secondary'}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {option.tag}
                          </Badge>
                        ) : null}
                        <span
                          className={cn(
                            'flex size-4 items-center justify-center rounded-full border transition-colors',
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/30 bg-transparent',
                          )}
                          aria-hidden
                        >
                          {isSelected ? <Check className="size-3" /> : null}
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-medium text-foreground/80">
                      {option.summary}
                    </span>

                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {option.description}
                    </p>
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <div className="space-y-1">
              <span className="font-medium text-foreground">
                Pedagogical Guarantee
              </span>
              <p className="leading-relaxed">
                Explanation detail adjusts length and depth of contextual steps.
                To ensure meaningful learning, Morshid will always guide you
                step by step and will never give direct solutions or final
                answers regardless of your preference.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isUnchanged || isLoading || isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Saving...
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
