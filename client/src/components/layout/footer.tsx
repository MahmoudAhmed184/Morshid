import { Logo } from '@/components/logo'

const productLinks = ['Features', 'Pricing', 'Use Cases', 'Changelog'] as const

const companyLinks = ['About Us', 'Careers', 'Blog', 'Contact'] as const

const legalLinks = [
  'Privacy Policy',
  'Terms of Service',
  'Cookie Policy',
] as const

type FooterLinkGroupProps = {
  title: string
  links: readonly string[]
  id?: string
}

function FooterLinkGroup({ title, links, id }: FooterLinkGroupProps) {
  return (
    <div id={id}>
      <h3 className="smallcaps-label">{title}</h3>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link}>
            <a href="#" className="link-editorial text-sm text-foreground">
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
    <footer className="rule bg-background">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-4 sm:col-span-2">
            <div className="flex items-center gap-2.5 text-foreground">
              <Logo iconClassName="size-6" />
              <span className="font-display text-xl font-semibold">
                Morshid
              </span>
            </div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Morshid — a Socratic tutor bound to course materials.
            </p>
          </div>

          <FooterLinkGroup title="Product" links={productLinks} id="pricing" />
          <FooterLinkGroup title="Company" links={companyLinks} id="about" />
          <FooterLinkGroup title="Legal" links={legalLinks} />
        </div>

        <div className="rule mt-16 pt-6">
          <p className="footnote flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span>© 2026 Morshid · Set in Fraunces &amp; Geist ·</span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-full bg-success ring-3 ring-success/20"
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
