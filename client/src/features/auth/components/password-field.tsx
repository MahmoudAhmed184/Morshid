import { Eye, EyeOff, Lock } from 'lucide-react'
import { useState } from 'react'

import { InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { cn } from '@/lib/utils'

import { AuthField } from './auth-field'

type PasswordFieldProps = {
  id?: string
  label?: string
  placeholder?: string
  autoComplete?: string
  forgotPasswordHref?: string
  className?: string
}

export function PasswordField({
  id = 'password',
  label = 'Security Key',
  placeholder = '••••••••',
  autoComplete = 'current-password',
  forgotPasswordHref = '#',
  className,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <AuthField
      id={id}
      label={label}
      icon={Lock}
      type={visible ? 'text' : 'password'}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className={className}
      labelAction={
        <a
          href={forgotPasswordHref}
          className={cn(
            'text-sm font-medium text-primary transition-colors hover:text-primary/80 sm:text-base',
          )}
        >
          Forgot Password?
        </a>
      }
      trailing={
        <InputGroupAddon align="inline-end" className="pr-1">
          <InputGroupButton
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </InputGroupButton>
        </InputGroupAddon>
      }
    />
  )
}
