import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import type { ComponentProps } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type PasswordFieldProps = Omit<
  ComponentProps<'input'>,
  'id' | 'type' | 'placeholder'
> & {
  id?: string
  label?: string
  placeholder?: string
  forgotPasswordHref?: string
  showForgotPassword?: boolean
  className?: string
}

export function PasswordField({
  id = 'password',
  label = 'Password',
  placeholder = '••••••••',
  forgotPasswordHref: _forgotPasswordHref,
  showForgotPassword: _showForgotPassword,
  className,
  ...inputProps
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={cn('space-y-1.5 sm:space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <Label
          htmlFor={id}
          className="text-[0.65rem] sm:text-[0.68rem] font-bold uppercase tracking-wider text-slate-700"
        >
          {label}
        </Label>
      </div>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete="current-password"
          className="h-10 sm:h-11 md:h-12 rounded-xl !border-slate-200 dark:!border-slate-200 !bg-slate-50/80 dark:!bg-slate-50/80 pr-11 text-sm !text-slate-900 dark:!text-slate-900 placeholder:!text-slate-400 focus-visible:!bg-white focus-visible:ring-1 focus-visible:!ring-[#0d848e]"
          {...inputProps}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:bg-transparent hover:text-slate-600"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </Button>
      </div>
    </div>
  )
}
