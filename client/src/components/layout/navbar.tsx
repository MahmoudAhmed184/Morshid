import { Link } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { useState } from 'react'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/ui/mode-toggle'
import { Separator } from '@/components/ui/separator'
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
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'About', href: '#about' },
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

function NavLink({ item, children, className, onClick }: NavLinkProps) {
  const linkClassName = cn(
    'text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
    className,
  )

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
    <header
      className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md"
      onWheel={(event) => event.preventDefault()}
    >
      <nav
        className="relative mx-auto flex h-16 w-full max-w-7xl items-center px-4 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        <div className="flex flex-1 items-center">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-foreground transition-opacity hover:opacity-80"
          >
            <Logo
              className="size-8 shrink rounded-lg bg-primary text-primary-foreground"
              iconClassName="size-4"
            />
            <span className="text-base font-semibold tracking-tight">
              Morshid
            </span>
          </Link>
        </div>

        <div className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <NavLink key={link.label} item={link}>
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
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
              <Button
                nativeButton={false}
                render={<Link to="/login" />}
                variant="ghost"
                className="hidden sm:inline-flex"
              >
                Log in
              </Button>
              <Button
                nativeButton={false}
                render={<Link to="/login" />}
                className="hidden sm:inline-flex"
              >
                Get Started
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
                <SheetTitle className="flex items-center gap-2">
                  <Logo
                    className="size-5 shrink rounded-none bg-transparent text-primary"
                    iconClassName="size-5"
                  />
                  Morshid
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-1 px-4">
                {navLinks.map((link) => (
                  <SheetClose
                    key={link.label}
                    nativeButton={false}
                    render={
                      <NavLink
                        item={link}
                        className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={() => setOpen(false)}
                      />
                    }
                  >
                    {link.label}
                  </SheetClose>
                ))}
                <Separator className="my-3" />
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
                        <Button
                          nativeButton={false}
                          render={<Link to="/login" />}
                          variant="outline"
                          className="w-full"
                        />
                      }
                    >
                      Log in
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
                      Get Started
                    </SheetClose>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  )
}
