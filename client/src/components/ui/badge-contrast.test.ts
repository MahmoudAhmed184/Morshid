import { describe, expect, it } from 'vitest'

const white = [255, 255, 255] as const
const warning = [0x76, 0x5a, 0x00] as const

describe('light-theme warning and gold badge contrast', () => {
  it('keeps normal-size text above 4.5:1 on the tinted badge surface', () => {
    const tintedBackground = warning.map((channel) =>
      Math.round(channel * 0.1 + 255 * 0.9),
    ) as [number, number, number]

    expect(contrastRatio(warning, tintedBackground)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(white, warning)).toBeGreaterThanOrEqual(4.5)
  })
})

function contrastRatio(
  foreground: readonly number[],
  background: readonly number[],
): number {
  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

function luminance(rgb: readonly number[]): number {
  const [red = 0, green = 0, blue = 0] = rgb.map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}
