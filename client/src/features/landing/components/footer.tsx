import { Logo } from '@/components/logo'

const productLinks = ['Features', 'Pricing', 'Use Cases', 'Changelog'] as const
const companyLinks = ['About Us', 'Careers', 'Blog', 'Contact'] as const
const legalLinks = ['Privacy Policy', 'Terms of Service', 'Cookie Policy'] as const

type FooterLinkGroupProps = {
  title: string
  links: readonly string[]
  id?: string
}

function FooterLinkGroup({ title, links, id }: FooterLinkGroupProps) {
  return (
    <div id={id}>
      <h3 className="smallcaps-label text-xs sm:text-sm">{title}</h3>
      <ul className="mt-2 space-y-1.5 sm:mt-4 sm:space-y-2.5">
        {links.map((link) => (
          <li key={link}>
            <a href="#" className="link-editorial text-xs text-foreground/80 hover:text-foreground sm:text-sm">
              {link}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="rounded-t-2xl border-t border-border/40 bg-secondary/40 sm:rounded-t-3xl">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-14 md:px-10">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand Col */}
          <div className="space-y-2 sm:col-span-2 sm:space-y-4">
            <div className="flex items-center gap-2 text-foreground">
              <Logo iconClassName="size-5 sm:size-6" />
              <span className="font-display text-lg font-semibold sm:text-xl">
                Morshid
              </span>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Morshid — a Socratic tutor bound to course materials.
            </p>
          </div>

          {/* Links Grid — 3 Columns on Mobile */}
          <div className="col-span-full grid grid-cols-3 gap-4 sm:col-span-2 sm:grid-cols-3 lg:col-span-3">
            <FooterLinkGroup title="Product" links={productLinks} id="pricing" />
            <FooterLinkGroup title="Company" links={companyLinks} id="about" />
            <FooterLinkGroup title="Legal" links={legalLinks} />
          </div>
        </div>

        <div className="rule mt-8 pt-4 sm:mt-12 sm:pt-6">
          <p className="footnote flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[0.7rem] sm:text-xs">
            <span>© 2026 Morshid · Set in Fraunces &amp; Geist</span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-1.5 rounded-full bg-success ring-2 ring-success/20 sm:size-2"
                aria-hidden
              />
              All systems operational
            </span>
          </p>
        </div>
      </div>
    </footer>
  )
}
