import { ArrowRight, Eye, EyeOff, Landmark, Loader2, User } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type TabValue = 'university' | 'admin'

// --- University name + code fields ---

type UniversityFieldsProps<T extends FieldValues> = {
  form: UseFormReturn<T>
  serverFieldErrors: Partial<Record<string, string>>
}

export function UniversityFields<T extends FieldValues>({
  form,
  serverFieldErrors,
}: UniversityFieldsProps<T>) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      <FormField
        control={form.control}
        name={'name' as Path<T>}
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel className="text-xs">
              University Name <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                className="h-9 text-xs"
                placeholder="e.g., King Saud University"
                onChange={(event) => {
                  field.onChange(event.target.value)
                  form.clearErrors('name' as Path<T>)
                }}
                aria-invalid={fieldState.error ? true : undefined}
              />
            </FormControl>
            <FormMessage />
            {serverFieldErrors.name ? (
              <p className="text-xs font-semibold text-destructive">
                {serverFieldErrors.name}
              </p>
            ) : null}
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={'code' as Path<T>}
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel className="text-xs">
              University Code <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                className="h-9 text-xs"
                placeholder="e.g., KSU"
                onChange={(event) => {
                  field.onChange(event.target.value.toUpperCase())
                  form.clearErrors('code' as Path<T>)
                }}
                aria-invalid={fieldState.error ? true : undefined}
              />
            </FormControl>
            <FormMessage />
            {serverFieldErrors.code ? (
              <p className="text-xs font-semibold text-destructive">
                {serverFieldErrors.code}
              </p>
            ) : null}
          </FormItem>
        )}
      />
    </div>
  )
}

// --- Manager name, email, password fields ---

type ManagerFieldsProps<T extends FieldValues> = {
  form: UseFormReturn<T>
  serverFieldErrors: Partial<Record<string, string>>
  passwordLabel?: string
  passwordPlaceholder?: string
  passwordDescription?: string
  showValidationErrors?: boolean
}

function PasswordInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        className={cn('h-9 text-xs pr-9', className)}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? (
          <EyeOff className="size-3.5" aria-hidden />
        ) : (
          <Eye className="size-3.5" aria-hidden />
        )}
      </Button>
    </div>
  )
}

export function ManagerFields<T extends FieldValues>({
  form,
  serverFieldErrors,
  passwordLabel = 'Password',
  passwordPlaceholder = 'Minimum 15 characters',
  passwordDescription = 'Must be at least 15 characters long.',
  showValidationErrors = true,
}: ManagerFieldsProps<T>) {
  return (
    <div className="space-y-3.5">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <FormField
          control={form.control}
          name={'ownerDisplayName' as Path<T>}
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel className="text-xs">
                Manager Full Name <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  className="h-9 text-xs"
                  placeholder="e.g., Dr. Fatima Al-Otaibi"
                  autoComplete="name"
                  onChange={(event) => {
                    field.onChange(event.target.value)
                    form.clearErrors('ownerDisplayName' as Path<T>)
                  }}
                  aria-invalid={
                    showValidationErrors && fieldState.error ? true : undefined
                  }
                />
              </FormControl>
              {showValidationErrors ? <FormMessage /> : null}
              {serverFieldErrors.ownerDisplayName ? (
                <p className="text-xs font-semibold text-destructive">
                  {serverFieldErrors.ownerDisplayName}
                </p>
              ) : null}
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={'ownerEmail' as Path<T>}
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel className="text-xs">
                Manager Email <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  className="h-9 text-xs"
                  placeholder="admin@ksu.edu.sa"
                  autoComplete="email"
                  onChange={(event) => {
                    field.onChange(event.target.value)
                    form.clearErrors('ownerEmail' as Path<T>)
                  }}
                  aria-invalid={
                    showValidationErrors && fieldState.error ? true : undefined
                  }
                />
              </FormControl>
              {showValidationErrors ? <FormMessage /> : null}
              {serverFieldErrors.ownerEmail ? (
                <p className="text-xs font-semibold text-destructive">
                  {serverFieldErrors.ownerEmail}
                </p>
              ) : null}
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name={'ownerPassword' as Path<T>}
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel className="text-xs">
              {passwordLabel} <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <PasswordInput
                {...field}
                placeholder={passwordPlaceholder}
                onChange={(event) => {
                  field.onChange(event.target.value)
                  form.clearErrors('ownerPassword' as Path<T>)
                }}
                aria-invalid={
                  showValidationErrors && fieldState.error ? true : undefined
                }
              />
            </FormControl>
            <FormDescription className="text-[11px] leading-normal">
              {passwordDescription}
            </FormDescription>
            {showValidationErrors ? <FormMessage /> : null}
            {serverFieldErrors.ownerPassword ? (
              <p className="text-xs font-semibold text-destructive">
                {serverFieldErrors.ownerPassword}
              </p>
            ) : null}
          </FormItem>
        )}
      />
    </div>
  )
}

// --- Two-tab layout with footer ---

type UniversityDialogTabsProps = {
  activeTab: TabValue
  onTabChange: (tab: TabValue) => void
  universityContent: ReactNode
  managerContent: ReactNode
  universityDescription: string
  managerDescription: string
  onCancel: () => void
  onNext: () => void
  onSubmit: () => void
  submitLabel: string
  submittingLabel: string
  isSubmitting: boolean
}

export function UniversityDialogTabs({
  activeTab,
  onTabChange,
  universityContent,
  managerContent,
  universityDescription,
  managerDescription,
  onCancel,
  onNext,
  onSubmit,
  submitLabel,
  submittingLabel,
  isSubmitting,
}: UniversityDialogTabsProps) {
  const tabTriggerClass =
    'flex h-full items-center justify-center gap-2 rounded-none border-b-2 border-transparent text-xs font-medium text-muted-foreground transition-all hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none'

  return (
    <>
      <Tabs
        value={activeTab}
        onValueChange={(val) => onTabChange(val as TabValue)}
        className="w-full space-y-3.5"
      >
        <TabsList className="grid h-10 w-full grid-cols-2 rounded-lg border bg-card p-0 shadow-xs">
          <TabsTrigger value="university" className={tabTriggerClass}>
            <Landmark className="size-3.5" aria-hidden />
            <span>University</span>
          </TabsTrigger>
          <TabsTrigger value="admin" className={tabTriggerClass}>
            <User className="size-3.5" aria-hidden />
            <span>Manager</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="university" forceMount className="space-y-3.5">
          <div>
            <h3 className="text-xs font-semibold text-foreground">
              University Information
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {universityDescription}
            </p>
          </div>
          {universityContent}
        </TabsContent>

        <TabsContent value="admin" forceMount className="space-y-3.5">
          <div>
            <h3 className="text-xs font-semibold text-foreground">
              Manager Information
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {managerDescription}
            </p>
          </div>
          {managerContent}
        </TabsContent>
      </Tabs>

      <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-2 border-t pt-3.5">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onTabChange('university')}
          disabled={activeTab === 'university' || isSubmitting}
        >
          Back
        </Button>
        {activeTab === 'university' ? (
          <Button type="button" onClick={onNext}>
            <span>Next: Manager</span>
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button type="button" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {submittingLabel}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}
