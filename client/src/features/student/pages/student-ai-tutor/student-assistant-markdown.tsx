import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { cn } from '@/lib/utils'

interface StudentAssistantMarkdownProps {
  content: string
  className?: string
}

const remarkPlugins = [remarkGfm]

const markdownComponents: Components = {
  h1: ({ children }) => <MarkdownHeading>{children}</MarkdownHeading>,
  h2: ({ children }) => <MarkdownHeading>{children}</MarkdownHeading>,
  h3: ({ children }) => <MarkdownSubheading>{children}</MarkdownSubheading>,
  h4: ({ children }) => <MarkdownSubheading>{children}</MarkdownSubheading>,
  h5: ({ children }) => <MarkdownSubheading>{children}</MarkdownSubheading>,
  h6: ({ children }) => <MarkdownSubheading>{children}</MarkdownSubheading>,
  p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1 pl-6 marker:text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1 pl-6 marker:font-medium marker:text-muted-foreground">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-primary/35 bg-muted/45 py-2 pr-3 pl-4 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  a: ({ children, href, title }) => (
    <a
      className="font-medium text-info underline decoration-info/35 underline-offset-4 hover:decoration-info focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      href={href}
      rel="noreferrer"
      target="_blank"
      title={title}
    >
      {children}
    </a>
  ),
  code: ({ children, className }) => (
    <code
      className={cn(
        'rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-foreground',
        className,
      )}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-4 max-w-full overflow-x-auto rounded-xl border border-border/80 bg-muted/65 p-4 font-mono text-xs leading-6 shadow-inner [&_code]:bg-transparent [&_code]:p-0 [&_code]:font-normal">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div
      aria-label="Scrollable response table"
      className="my-4 max-w-full overflow-x-auto rounded-xl border"
      role="region"
      tabIndex={0}
    >
      <table className="w-full border-collapse text-left text-xs">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/70">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b px-3 py-2 font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/70 px-3 py-2 align-top last:border-b-0">
      {children}
    </td>
  ),
  hr: () => <hr className="my-5 border-border/70" />,
  img: ({ alt }) => (
    <span className="text-muted-foreground">
      {alt ? `[Image: ${alt}]` : ''}
    </span>
  ),
}

export function StudentAssistantMarkdown({
  content,
  className,
}: StudentAssistantMarkdownProps) {
  return (
    <div className={cn('min-w-0 break-words', className)}>
      <ReactMarkdown
        components={markdownComponents}
        remarkPlugins={remarkPlugins}
        skipHtml
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function MarkdownHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-5 mb-2 font-serif text-lg font-semibold leading-snug text-foreground first:mt-0">
      {children}
    </h3>
  )
}

function MarkdownSubheading({ children }: { children: ReactNode }) {
  return (
    <h4 className="mt-4 mb-2 text-sm font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h4>
  )
}
