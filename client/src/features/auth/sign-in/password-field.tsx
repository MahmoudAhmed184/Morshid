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
    <div className={cn('flex flex-col gap-1.5 sm:gap-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <Label
          htmlFor={id}
          className="text-[0.65rem] font-bold tracking-wider text-muted-foreground uppercase sm:text-[0.68rem]"
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
          className="h-10 rounded-xl pr-11 sm:h-11 md:h-12"
          {...inputProps}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      </div>
    </div>
  )
}
