import { ArrowRight, Landmark, Loader2, User } from 'lucide-react'
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
import { PasswordField } from '@/features/auth/sign-in/password-field'
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
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        control={form.control}
        name={'name' as Path<T>}
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel>
              University Name <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="e.g., King Saud University"
                aria-invalid={fieldState.error ? true : undefined}
              />
            </FormControl>
            <FormDescription className="text-xs">
              Full legal name of the university.
            </FormDescription>
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
            <FormLabel>
              University Code <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="e.g., KSU"
                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                aria-invalid={fieldState.error ? true : undefined}
              />
            </FormControl>
            <FormDescription className="text-xs">
              Unique code (2–50 characters).
            </FormDescription>
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
}

export function ManagerFields<T extends FieldValues>({
  form,
  serverFieldErrors,
  passwordLabel = 'Password',
  passwordPlaceholder = 'Minimum 15 characters',
  passwordDescription = 'Must be at least 15 characters long.',
}: ManagerFieldsProps<T>) {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name={'ownerDisplayName' as Path<T>}
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel>
              Manager Full Name <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="e.g., Dr. Fatima Al-Otaibi"
                autoComplete="name"
                aria-invalid={fieldState.error ? true : undefined}
              />
            </FormControl>
            <FormDescription className="text-xs">
              Full name of the primary manager.
            </FormDescription>
            <FormMessage />
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
            <FormLabel>
              Manager Email <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                type="email"
                placeholder="admin@ksu.edu.sa"
                autoComplete="email"
                aria-invalid={fieldState.error ? true : undefined}
              />
            </FormControl>
            <FormDescription className="text-xs">
              Work email used for logging into the manager portal.
            </FormDescription>
            <FormMessage />
            {serverFieldErrors.ownerEmail ? (
              <p className="text-xs font-semibold text-destructive">
                {serverFieldErrors.ownerEmail}
              </p>
            ) : null}
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={'ownerPassword' as Path<T>}
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel>
              {passwordLabel} <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <PasswordField
                {...field}
                placeholder={passwordPlaceholder}
                aria-invalid={fieldState.error ? true : undefined}
              />
            </FormControl>
            <FormDescription className="text-xs">
              {passwordDescription}
            </FormDescription>
            <FormMessage />
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
  submitLabel,
  submittingLabel,
  isSubmitting,
}: UniversityDialogTabsProps) {
  const tabTriggerClass =
    'flex h-full items-center justify-center gap-2 rounded-none border-b-2 border-transparent text-sm font-medium text-muted-foreground transition-all hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none'

  return (
    <>
      <Tabs
        value={activeTab}
        onValueChange={(val) => onTabChange(val as TabValue)}
        className="w-full space-y-4"
      >
        <TabsList className="grid h-12 w-full grid-cols-2 rounded-xl border bg-card p-0 shadow-xs">
          <TabsTrigger value="university" className={tabTriggerClass}>
            <Landmark className="size-4" aria-hidden />
            <span>University</span>
          </TabsTrigger>
          <TabsTrigger value="admin" className={tabTriggerClass}>
            <User className="size-4" aria-hidden />
            <span>Manager</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="university"
          forceMount
          className={cn('space-y-4', activeTab !== 'university' && 'hidden')}
        >
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              University Information
            </h3>
            <p className="text-xs text-muted-foreground">
              {universityDescription}
            </p>
          </div>
          {universityContent}
        </TabsContent>

        <TabsContent
          value="admin"
          forceMount
          className={cn('space-y-4', activeTab !== 'admin' && 'hidden')}
        >
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Manager Information
            </h3>
            <p className="text-xs text-muted-foreground">
              {managerDescription}
            </p>
          </div>
          {managerContent}
        </TabsContent>
      </Tabs>

      <DialogFooter className="mt-6 flex flex-row items-center justify-end gap-2 border-t pt-4">
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
          <Button type="submit" disabled={isSubmitting}>
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
