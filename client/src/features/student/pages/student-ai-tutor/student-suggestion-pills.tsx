const suggestions = [
  'Why does quicksort average O(n log n)?',
  'Walk me through problem set 3.',
  'What did lecture 8 actually claim?',
] as const

/**
 * Decorative, non-interactive prompt suggestions shown in the empty workspace.
 * Purely visual (aria-hidden) — they seed the reader's imagination, not a
 * clickable feature, since live tutoring is not yet wired up.
 */
export function StudentSuggestionPills() {
  return (
    <div className="flex max-w-xl flex-wrap justify-center gap-2" aria-hidden>
      {suggestions.map((suggestion) => (
        <span
          key={suggestion}
          className="glass-paper footnote rounded-full px-4 py-2"
        >
          {suggestion}
        </span>
      ))}
    </div>
  )
}
