import { Link } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { useState } from 'react'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/ui/mode-toggle'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { getDashboardPath } from '@/features/auth/utils/auth-redirect'
import { cn } from '@/lib/utils'

const marketingNavLinks = [
  { label: 'The Method', href: '/#method' },
  { label: 'For Instructors', href: '/#instructors' },
] as const

const instructorNavLinks = [
  { label: 'Overview', to: '/instructor' },
  { label: 'Materials', to: '/instructor', hash: 'materials' },
  { label: 'Review queue', to: '/instructor', hash: 'reviews' },
] as const

type NavLinkProps = {
  item: (typeof marketingNavLinks)[number] | (typeof instructorNavLinks)[number]
  children?: React.ReactNode
  className?: string
  onClick?: () => void
}

const navLinkClassName =
  'smallcaps-label transition-colors duration-200 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none'

function NavLink({ item, children, className, onClick }: NavLinkProps) {
  const linkClassName = cn(navLinkClassName, className)

  if ('to' in item) {
    return (
      <Link
        to={item.to}
        hash={'hash' in item ? item.hash : undefined}
        onClick={onClick}
        className={linkClassName}
      >
        {children}
      </Link>
    )
  }

  return (
    <a href={item.href} onClick={onClick} className={linkClassName}>
      {children}
    </a>
  )
}

export function Navbar() {
  const [open, setOpen] = useState(false)
  const user = useAuthStore((state) => state.user)
  const dashboardPath = user ? getDashboardPath(user.role) : null
  const navLinks =
    user?.role === 'INSTRUCTOR' ? instructorNavLinks : marketingNavLinks

  return (
    <header className="rule sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
      <nav
        className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-6 md:px-10"
        aria-label="Main navigation"
      >
        <div className="flex flex-1 items-center">
          <Link
            to="/"
            className="group flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-90 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Logo iconClassName="size-6" />
            <span className="font-display text-xl font-semibold">Morshid</span>
          </Link>
        </div>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <NavLink key={link.label} item={link}>
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="flex flex-1 items-center justify-end gap-4 sm:gap-5">
          <ModeToggle />
          {dashboardPath ? (
            <Button
              nativeButton={false}
              render={<Link to={dashboardPath} />}
              className="hidden sm:inline-flex"
            >
              Dashboard
            </Button>
          ) : (
            <>
              <Link
                to="/login"
                className={cn(navLinkClassName, 'hidden sm:inline-flex')}
              >
                Sign in
              </Link>
              <Button
                nativeButton={false}
                render={<Link to="/login" />}
                className="hidden sm:inline-flex"
              >
                Begin studying
              </Button>
            </>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open menu"
                />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2.5">
                  <Logo iconClassName="size-5" />
                  <span className="font-display text-lg font-semibold">
                    Morshid
                  </span>
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-6">
                {navLinks.map((link) => (
                  <SheetClose
                    key={link.label}
                    nativeButton={false}
                    render={
                      <NavLink
                        item={link}
                        className="py-1"
                        onClick={() => setOpen(false)}
                      />
                    }
                  >
                    {link.label}
                  </SheetClose>
                ))}
                <div className="rule mt-2 flex flex-col gap-3 pt-4">
                  {dashboardPath ? (
                    <SheetClose
                      nativeButton={false}
                      render={
                        <Button
                          nativeButton={false}
                          render={<Link to={dashboardPath} />}
                          className="w-full"
                        />
                      }
                    >
                      Dashboard
                    </SheetClose>
                  ) : (
                    <>
                      <SheetClose
                        nativeButton={false}
                        render={
                          <Link
                            to="/login"
                            className={cn(navLinkClassName, 'py-1')}
                          />
                        }
                      >
                        Sign in
                      </SheetClose>
                      <SheetClose
                        nativeButton={false}
                        render={
                          <Button
                            nativeButton={false}
                            render={<Link to="/login" />}
                            className="w-full"
                          />
                        }
                      >
                        Begin studying
                      </SheetClose>
                    </>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  )
}
