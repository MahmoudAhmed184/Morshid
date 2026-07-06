import { AuthLayout } from './components/auth-layout'
import { SignInForm } from './components/sign-in-form'

export function SignInPage() {
  return (
    <main>
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </main>
  )
}
