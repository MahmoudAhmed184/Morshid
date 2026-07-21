export function normalizeExtractedText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/\r\n?/gu, '\n')
    .replace(/\f/gu, '\n\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\v]+/gu, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
}
