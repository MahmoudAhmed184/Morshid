export function assertGeneratedOutputMatches(
  path: string,
  baseline: string,
  generated: string,
): void {
  if (baseline !== generated) {
    throw new Error(
      `${path} differs from official generation; regenerate and commit the generated output without hand edits`,
    )
  }
}
