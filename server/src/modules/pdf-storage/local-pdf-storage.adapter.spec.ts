import {
  access,
  mkdtemp,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  InvalidPdfStoragePathError,
  PdfStorageNotFoundError,
  type PdfStorage,
} from './pdf-storage'
import { LocalPdfStorageAdapter } from './local-pdf-storage.adapter'

describe('LocalPdfStorageAdapter', () => {
  let rootPath: string
  let storage: PdfStorage

  beforeEach(async () => {
    rootPath = await mkdtemp(join(tmpdir(), 'morshid-pdf-storage-'))
    storage = new LocalPdfStorageAdapter(rootPath)
  })

  afterEach(async () => {
    await rm(rootPath, { recursive: true, force: true })
  })

  it('round-trips PDF bytes through a generated relative key', async () => {
    const contents = Buffer.from('%PDF-1.7\ntest bytes')

    const storagePath = await storage.create(contents)

    expect(storagePath).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/,
    )
    await expect(storage.read(storagePath)).resolves.toEqual(contents)
  })

  it('generates a unique flat name for every stored PDF', async () => {
    const firstPath = await storage.create(Buffer.from('first'))
    const secondPath = await storage.create(Buffer.from('second'))

    expect(firstPath).not.toBe(secondPath)
    expect(firstPath).not.toContain('/')
    expect(secondPath).not.toContain('/')
  })

  it('creates a missing configured root automatically', async () => {
    const missingRoot = join(rootPath, 'missing', 'pdfs')
    const storageWithMissingRoot = new LocalPdfStorageAdapter(missingRoot)

    const storagePath = await storageWithMissingRoot.create(
      Buffer.from('created root'),
    )

    await expect(storageWithMissingRoot.read(storagePath)).resolves.toEqual(
      Buffer.from('created root'),
    )
  })

  it('uses exclusive creation without replacing an existing file', async () => {
    const collidingPath = 'collision.pdf'
    const replacementPath = 'fresh.pdf'
    await writeFile(join(rootPath, collidingPath), 'existing bytes')
    const keys = [collidingPath, replacementPath]
    const storageWithCollision = new LocalPdfStorageAdapter(
      rootPath,
      () => keys.shift() ?? replacementPath,
    )

    await expect(
      storageWithCollision.create(Buffer.from('new bytes')),
    ).resolves.toBe(replacementPath)
    await expect(storageWithCollision.read(collidingPath)).resolves.toEqual(
      Buffer.from('existing bytes'),
    )
    await expect(storageWithCollision.read(replacementPath)).resolves.toEqual(
      Buffer.from('new bytes'),
    )
  })

  it.each([
    '/tmp/absolute.pdf',
    '../traversal.pdf',
    'nested/file.pdf',
    'nested\\file.pdf',
  ])('rejects non-flat storage path %s', async (storagePath) => {
    await expect(storage.read(storagePath)).rejects.toBeInstanceOf(
      InvalidPdfStoragePathError,
    )
    await expect(storage.delete(storagePath)).rejects.toBeInstanceOf(
      InvalidPdfStoragePathError,
    )

    const storageWithInvalidKey = new LocalPdfStorageAdapter(
      rootPath,
      () => storagePath,
    )
    await expect(
      storageWithInvalidKey.create(Buffer.from('never stored')),
    ).rejects.toBeInstanceOf(InvalidPdfStoragePathError)
  })

  it('rejects a flat symlink that resolves outside the canonical root', async () => {
    const outsideRoot = await mkdtemp(join(tmpdir(), 'morshid-pdf-outside-'))
    const outsidePath = join(outsideRoot, 'outside.pdf')
    const storagePath = 'escape.pdf'
    await writeFile(outsidePath, 'outside bytes')
    await symlink(outsidePath, join(rootPath, storagePath))

    try {
      await expect(storage.read(storagePath)).rejects.toBeInstanceOf(
        InvalidPdfStoragePathError,
      )
      await expect(storage.delete(storagePath)).rejects.toBeInstanceOf(
        InvalidPdfStoragePathError,
      )
      await expect(access(outsidePath)).resolves.toBeUndefined()
    } finally {
      await rm(outsideRoot, { recursive: true, force: true })
    }
  })

  it('returns a typed error when a PDF is missing', async () => {
    await expect(storage.read('missing.pdf')).rejects.toBeInstanceOf(
      PdfStorageNotFoundError,
    )
  })

  it('deletes an existing PDF and ignores missing files and roots', async () => {
    const storagePath = await storage.create(Buffer.from('temporary'))

    await expect(storage.delete(storagePath)).resolves.toBeUndefined()
    await expect(storage.delete(storagePath)).resolves.toBeUndefined()
    await expect(storage.read(storagePath)).rejects.toBeInstanceOf(
      PdfStorageNotFoundError,
    )

    const missingRootStorage = new LocalPdfStorageAdapter(
      join(rootPath, 'does-not-exist'),
    )
    await expect(
      missingRootStorage.delete('missing.pdf'),
    ).resolves.toBeUndefined()
  })

  it('removes a partially written file after a write failure', async () => {
    const writeFailure = new Error('simulated write failure')
    const failingStorage = new LocalPdfStorageAdapter(
      rootPath,
      () => 'partial.pdf',
      async (handle) => {
        await handle.writeFile(Buffer.from('partial bytes'))
        throw writeFailure
      },
    )

    await expect(failingStorage.create(Buffer.from('full bytes'))).rejects.toBe(
      writeFailure,
    )
    await expect(readdir(rootPath)).resolves.toEqual([])
  })
})
