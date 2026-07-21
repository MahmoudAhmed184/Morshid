export const TASK_80_SENTINEL = 'SYNTHETIC_SENTINEL_TASK80_7f2b'

export function cleanTextPdf(
  text = `Variables bind names to values. ${TASK_80_SENTINEL}`,
): Buffer {
  const content = `BT /F1 18 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`
  return buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    streamObject(content),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ])
}

export function partiallyEmptyTextPdf(
  text = `Variables bind names to values. ${TASK_80_SENTINEL}`,
): Buffer {
  const textContent = `BT /F1 18 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`
  return buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',
    streamObject(textContent),
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 6 0 R >>',
    streamObject(''),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ])
}

export function emptyPdf(): Buffer {
  return buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>',
    streamObject(''),
  ])
}

export function imageOnlyPdf(): Buffer {
  return buildPdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 6 0 R >> >> /Contents 4 0 R >>',
    streamObject('q 100 0 0 100 0 0 cm /Im0 Do Q'),
    '<< /XObject << /Im0 6 0 R >> >>',
    `<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3 >>\nstream\n${String.fromCharCode(255, 0, 0)}\nendstream`,
  ])
}

export function invalidPdfSignature(): Buffer {
  return Buffer.from(`not-a-pdf ${TASK_80_SENTINEL}`)
}

export function corruptPdfWithPdfFilename(): Buffer {
  return Buffer.from('%PDF-1.7\n1 0 obj\n<< /Broken true >>\n')
}

export function oversizedPdf(minimumBytes: number): Buffer {
  const base = cleanTextPdf()
  if (base.byteLength >= minimumBytes) {
    return base
  }

  return Buffer.concat([base, Buffer.alloc(minimumBytes - base.byteLength)])
}

function streamObject(content: string): string {
  return `<< /Length ${String(Buffer.byteLength(content))} >>\nstream\n${content}\nendstream`
}

function escapePdfText(text: string): string {
  return text
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
}

function buildPdf(objects: readonly string[]): Buffer {
  const header = Buffer.from('%PDF-1.4\n%\xff\xff\xff\xff\n', 'latin1')
  const body: Buffer[] = [header]
  const offsets = [0]
  let offset = header.byteLength

  for (const [index, object] of objects.entries()) {
    const serialized = Buffer.from(
      `${String(index + 1)} 0 obj\n${object}\nendobj\n`,
      'latin1',
    )
    offsets.push(offset)
    body.push(serialized)
    offset += serialized.byteLength
  }

  const xrefOffset = offset
  const xref = [`xref\n0 ${String(objects.length + 1)}`, '0000000000 65535 f ']
  for (const objectOffset of offsets.slice(1)) {
    xref.push(`${String(objectOffset).padStart(10, '0')} 00000 n `)
  }
  xref.push(
    `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>`,
    `startxref\n${String(xrefOffset)}\n%%EOF\n`,
  )
  body.push(Buffer.from(xref.join('\n'), 'latin1'))
  return Buffer.concat(body)
}
