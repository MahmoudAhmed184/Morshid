import { Paperclip, SendHorizontal, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface StudentDisabledComposerProps {
  hasSelectedSession: boolean
}

export function StudentDisabledComposer({
  hasSelectedSession,
}: StudentDisabledComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])

    setSelectedFiles((currentFiles) => {
      const uniqueFiles = new Map(
        currentFiles.map((file) => [
          `${file.name}-${file.size}-${file.lastModified}`,
          file,
        ]),
      )

      files.forEach((file) => {
        uniqueFiles.set(`${file.name}-${file.size}-${file.lastModified}`, file)
      })

      return Array.from(uniqueFiles.values())
    })
    event.currentTarget.value = ''
  }

  const removeFile = (fileToRemove: File) => {
    setSelectedFiles((currentFiles) =>
      currentFiles.filter((file) => file !== fileToRemove),
    )
  }

  return (
    <footer className="bg-gradient-to-t from-slate-50 via-slate-50 to-transparent px-4 pt-3 pb-5 sm:px-8">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-500/10">
        {selectedFiles.length > 0 ? (
          <ul
            aria-label="Selected attachments"
            className="flex flex-wrap gap-2 px-2 pt-1 pb-2"
          >
            {selectedFiles.map((file) => (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="flex min-w-0 max-w-full items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-1 pr-1 pl-2.5 text-xs text-slate-700"
              >
                <span className="max-w-48 truncate" title={file.name}>
                  {file.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => removeFile(file)}
                  className="size-6 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="relative">
          <Textarea
            aria-label="Message"
            disabled
            placeholder={
              hasSelectedSession
                ? 'Message sending is not available yet.'
                : 'Select a conversation first.'
            }
            name="chat-message"
            autoComplete="off"
            className="min-h-24 resize-none border-0 bg-transparent px-3 pt-2 pb-12 shadow-none focus-visible:ring-0"
          />

          <input
            ref={fileInputRef}
            type="file"
            name="chat-attachments"
            multiple
            tabIndex={-1}
            aria-label="Choose files"
            onChange={handleFileSelection}
            className="sr-only"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!hasSelectedSession}
            aria-label="Attach file"
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-1 left-1 size-9 rounded-[10px] text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <Paperclip className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            disabled
            aria-label="Send message"
            className="absolute right-1 bottom-1 size-9 rounded-[10px] bg-blue-600 text-white"
          >
            <SendHorizontal className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
      <p className="mx-auto mt-2 max-w-5xl text-center text-xs text-muted-foreground">
        Sending will be enabled in the next Student Chat story.
      </p>
    </footer>
  )
}
