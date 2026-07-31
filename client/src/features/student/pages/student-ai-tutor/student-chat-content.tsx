import type { ReactNode } from 'react'

import type { ChatMessage } from '@/features/student/schemas/student-chat.schema'

interface StudentChatContentProps {
  message: ChatMessage
}

interface ContentPart {
  kind: 'code' | 'text'
  content: string
  language?: string
}

export function StudentChatContent({ message }: StudentChatContentProps) {
  const parts = splitFencedCode(message.content)
  const isUnfencedStudentDiagnosis =
    message.role === 'STUDENT' &&
    message.requestKind === 'CODE_DIAGNOSIS' &&
    parts.every(({ kind }) => kind === 'text') &&
    message.content.includes('\n')

  if (isUnfencedStudentDiagnosis) {
    return <CodeBlock content={message.content} language="python" />
  }

  return (
    <div className="space-y-3 break-words">
      {parts.map((part, index) =>
        part.kind === 'code' ? (
          <CodeBlock
            key={`${part.kind}:${index.toString()}`}
            content={part.content}
            language={part.language}
          />
        ) : (
          <div
            key={`${part.kind}:${index.toString()}`}
            className="whitespace-pre-wrap"
          >
            {renderInlineCode(part.content)}
          </div>
        ),
      )}
    </div>
  )
}

function CodeBlock({
  content,
  language,
}: {
  content: string
  language?: string
}) {
  const normalizedLanguage = language?.trim().toLowerCase()
  const label = normalizedLanguage ? `${normalizedLanguage} code` : 'Code block'

  return (
    <pre
      aria-label={label}
      className="max-w-full overflow-x-auto rounded-lg border border-border bg-secondary/70 p-3 font-mono text-xs leading-5 text-foreground"
      tabIndex={0}
    >
      <code>{content.replace(/\n$/u, '')}</code>
    </pre>
  )
}

function renderInlineCode(content: string): ReactNode[] {
  return content.split(/(`[^`\r\n]+`)/gu).map((part, index) =>
    part.startsWith('`') && part.endsWith('`') ? (
      <code
        key={`code:${index.toString()}`}
        className="rounded border border-border bg-secondary px-1 py-0.5 font-mono text-[0.85em] text-foreground"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  )
}

function splitFencedCode(content: string): ContentPart[] {
  const parts: ContentPart[] = []
  const pattern = /```([^\r\n`]*)\r?\n([\s\S]*?)```/gu
  let cursor = 0

  for (const match of content.matchAll(pattern)) {
    const index = match.index
    if (index > cursor) {
      parts.push({ kind: 'text', content: content.slice(cursor, index) })
    }
    parts.push({
      kind: 'code',
      content: match[2],
      ...(match[1].trim() === '' ? {} : { language: match[1].trim() }),
    })
    cursor = index + match[0].length
  }

  if (cursor < content.length) {
    parts.push({ kind: 'text', content: content.slice(cursor) })
  }
  if (parts.length === 0) {
    parts.push({ kind: 'text', content })
  }

  return parts.filter(
    ({ kind, content: partContent }) =>
      kind === 'code' || partContent.length > 0,
  )
}
