import { SignOutButton } from '@/features/auth/components/sign-out-button'

type RolePlaceholderPageProps = {
  roleName: string
}

export function RolePlaceholderPage({ roleName }: RolePlaceholderPageProps) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-3xl font-semibold text-foreground">{roleName}</h1>
        <SignOutButton />
      </div>
    </main>
  )
}
