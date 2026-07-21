import { Eye, EyeOff } from 'lucide-react'
import * as React from 'react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import { RuledFieldInput } from './ruled-field-input'

type PasswordFieldProps = Omit<
  React.ComponentProps<'input'>,
  'id' | 'type' | 'placeholder'
> & {
  id?: string
  label?: string
  placeholder?: string
  forgotPasswordHref?: string
  showForgotPassword?: boolean
  className?: string
}

export const PasswordField = React.forwardRef<
  HTMLInputElement,
  PasswordFieldProps
>(function PasswordFieldInput(
  {
    id = 'password',
    label = 'Password',
    placeholder = '••••••••',
    forgotPasswordHref = '#',
    showForgotPassword = true,
    className,
    ...inputProps
  },
  ref,
) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={cn('space-y-2.5', className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="smallcaps-label">
          {label}
        </Label>
        {showForgotPassword ? (
          <a
            href={forgotPasswordHref}
            className="link-editorial font-mono text-xs text-muted-foreground"
          >
            Forgot password?
          </a>
        ) : null}
      </div>
      <div className="relative">
        <RuledFieldInput
          ref={ref}
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          autoComplete="current-password"
          className="pr-9"
          {...inputProps}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 my-auto text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      </div>
    </div>
  )
})
