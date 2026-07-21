const credoItems = [
  'Grounded in your syllabus',
  'Cited to the page',
  'Socratic by method',
  'Ready the night before the exam',
] as const

export function CredoStrip() {
  return (
    <div className="rule border-b">
      <div className="mx-auto w-full max-w-6xl px-6 py-5 md:px-10">
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {credoItems.map((item, index) => (
            <li key={item} className="flex items-center gap-x-3">
              {index > 0 && (
                <span className="smallcaps-label" aria-hidden>
                  ·
                </span>
              )}
              <span className="smallcaps-label">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
