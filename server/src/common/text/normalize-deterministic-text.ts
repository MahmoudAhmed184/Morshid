// Deterministic embedding and completion adapters intentionally share this
// identity normalization: extraction whitespace and Unicode compatibility
// forms must not make otherwise identical offline fixtures diverge. Case is
// preserved because locale-sensitive folding can change meaning.
export function normalizeDeterministicText(text: string): string {
  return text.normalize('NFKC').trim().replace(/\s+/gu, ' ')
}
