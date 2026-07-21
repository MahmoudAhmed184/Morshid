import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/ui/mode-toggle'
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
  style?: React.CSSProperties
  onClick?: () => void
}

const navLinkClassName =
  'smallcaps-label rounded-sm transition-colors duration-200 outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background'

function NavLink({ item, children, className, style, onClick }: NavLinkProps) {
  const linkClassName = cn(navLinkClassName, className)

  if ('to' in item) {
    return (
      <Link
        to={item.to}
        hash={'hash' in item ? item.hash : undefined}
        onClick={onClick}
        className={linkClassName}
        style={style}
      >
        {children}
      </Link>
    )
  }

  return (
    <a
      href={item.href}
      onClick={onClick}
      className={linkClassName}
      style={style}
    >
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

  const closeMenu = () => setOpen(false)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)

    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <header className="fixed inset-x-4 top-4 z-50">
      <nav
        className="glass-paper relative mx-auto flex h-14 w-full max-w-6xl items-center gap-4 rounded-full pr-2 pl-5 shadow-md"
        aria-label="Main navigation"
      >
        <Link
          to="/"
          className="group flex items-center gap-2.5 rounded-full text-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Logo iconClassName="size-[22px]" />
          <span className="font-display text-lg font-semibold">Morshid</span>
        </Link>

        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <NavLink key={link.label} item={link}>
              {link.label}
            </NavLink>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />

          {dashboardPath ? (
            <Button
              nativeButton={false}
              render={<Link to={dashboardPath} />}
              className="hidden lg:inline-flex"
            >
              Dashboard
            </Button>
          ) : (
            <>
              <Link
                to="/login"
                className={cn(navLinkClassName, 'hidden px-2 lg:inline-flex')}
              >
                Sign in
              </Link>
              <Button
                nativeButton={false}
                render={<Link to="/login" />}
                className="hidden lg:inline-flex"
              >
                Begin studying
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </nav>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 -z-10 cursor-default outline-none lg:hidden focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={closeMenu}
          />
          <nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className="glass-paper mx-auto mt-2 flex w-full max-w-6xl flex-col gap-1 rounded-3xl p-4 shadow-lg lg:hidden"
          >
            {navLinks.map((link, index) => (
              <NavLink
                key={link.label}
                item={link}
                className="py-2 motion-safe:animate-fade-up"
                style={{ animationDelay: `${index * 60}ms` }}
                onClick={closeMenu}
              >
                {link.label}
              </NavLink>
            ))}

            <div
              className="rule mt-2 flex flex-col gap-3 pt-4 motion-safe:animate-fade-up"
              style={{ animationDelay: `${navLinks.length * 60}ms` }}
            >
              {dashboardPath ? (
                <Button
                  nativeButton={false}
                  render={<Link to={dashboardPath} />}
                  className="w-full"
                  onClick={closeMenu}
                >
                  Dashboard
                </Button>
              ) : (
                <>
                  <Link
                    to="/login"
                    className={cn(navLinkClassName, 'py-1')}
                    onClick={closeMenu}
                  >
                    Sign in
                  </Link>
                  <Button
                    nativeButton={false}
                    render={<Link to="/login" />}
                    className="w-full"
                    onClick={closeMenu}
                  >
                    Begin studying
                  </Button>
                </>
              )}
            </div>
          </nav>
        </>
      )}
    </header>
  )
}
