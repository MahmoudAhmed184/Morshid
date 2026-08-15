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
    <div className={cn('space-y-1 sm:space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-3">
        <Label
          htmlFor={id}
          className="text-[0.62rem] sm:text-[0.65rem] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
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
          className="h-9 sm:h-9.5 md:h-10 rounded-xl border-slate-200 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-900/80 pr-10 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:bg-white dark:focus-visible:bg-slate-900 focus-visible:ring-1 focus-visible:ring-[#0d848e] dark:focus-visible:ring-[#2dd4bf]"
          {...inputProps}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:bg-transparent hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          {visible ? (
            <EyeOff className="size-3.5" aria-hidden />
          ) : (
            <Eye className="size-3.5" aria-hidden />
          )}
        </Button>
      </div>
    </div>
  )
}
