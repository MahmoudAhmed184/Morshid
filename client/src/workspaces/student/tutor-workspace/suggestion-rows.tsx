import { cn } from '@/lib/utils'

const suggestions = [
  'How do while loops and for loops differ in Python?',
  'How do lists and dictionaries store data differently in Python?',
  'How does variable scope work inside functions?',
] as const

interface StudentSuggestionRowsProps {
  onSelect: (text: string) => void
}

/**
 * Plain, hairline-separated prompt rows shown in the empty workspace. Clicking a
 * row prefills the composer draft (client-side only) and focuses it.
 */
export function StudentSuggestionRows({
  onSelect,
}: StudentSuggestionRowsProps) {
  return (
    <div className="w-full max-w-xl">
      {suggestions.map((suggestion, index) => (
        <button
          key={suggestion}
          type="button"
          onClick={() => onSelect(suggestion)}
          className={cn(
            'block w-full cursor-pointer py-3 text-left text-sm text-muted-foreground transition-colors hover:text-foreground',
            index > 0 && 'rule',
          )}
        >
          {suggestion}
        </button>
      ))}
    </div>
  )
}
