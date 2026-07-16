import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import {
  mkdir,
  open,
  realpath,
  unlink,
  type FileHandle,
} from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'

import {
  InvalidPdfStoragePathError,
  PdfStorageNotFoundError,
  type PdfStorage,
} from './pdf-storage'

const MAX_CREATE_ATTEMPTS = 10

type StorageKeyFactory = () => string
type StorageWriter = (handle: FileHandle, contents: Buffer) => Promise<void>

export class LocalPdfStorageAdapter implements PdfStorage {
  private readonly rootPath: string

  constructor(
    rootPath: string,
    private readonly generateStorageKey: StorageKeyFactory = () =>
      `${randomUUID()}.pdf`,
    private readonly writeContents: StorageWriter = (handle, contents) =>
      handle.writeFile(contents),
  ) {
    if (rootPath.trim().length === 0) {
      throw new Error('PDF storage root must not be blank')
    }

    this.rootPath = resolve(rootPath)
  }

  async create(contents: Buffer): Promise<string> {
    await mkdir(this.rootPath, { recursive: true })
    const canonicalRoot = await realpath(this.rootPath)

    for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
      const storagePath = this.generateStorageKey()
      const targetPath = this.resolveFlatPath(canonicalRoot, storagePath)
      let handle: FileHandle

      try {
        handle = await open(
          targetPath,
          constants.O_WRONLY |
            constants.O_CREAT |
            constants.O_EXCL |
            constants.O_NOFOLLOW,
          0o600,
        )
      } catch (error) {
        if (isFileSystemError(error, 'EEXIST')) {
          continue
        }

        throw error
      }

      return this.writeCreatedFile(handle, targetPath, storagePath, contents)
    }

    throw new Error('Could not allocate a unique PDF storage path')
  }

  async read(storagePath: string): Promise<Buffer> {
    this.assertFlatPath(storagePath)
    const canonicalRoot = await this.findCanonicalRoot(storagePath)
    const targetPath = this.resolveFlatPath(canonicalRoot, storagePath)
    const canonicalTarget = await this.findCanonicalTarget(
      canonicalRoot,
      targetPath,
      storagePath,
    )

    let handle: FileHandle

    try {
      handle = await open(
        canonicalTarget,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      )
    } catch (error) {
      if (isFileSystemError(error, 'ENOENT')) {
        throw new PdfStorageNotFoundError(storagePath)
      }

      if (isFileSystemError(error, 'ELOOP')) {
        throw new InvalidPdfStoragePathError(storagePath)
      }

      throw error
    }

    try {
      return await handle.readFile()
    } finally {
      await handle.close()
    }
  }

  async delete(storagePath: string): Promise<void> {
    this.assertFlatPath(storagePath)
    let canonicalRoot: string

    try {
      canonicalRoot = await realpath(this.rootPath)
    } catch (error) {
      if (isFileSystemError(error, 'ENOENT')) {
        return
      }

      throw error
    }

    const targetPath = this.resolveFlatPath(canonicalRoot, storagePath)

    try {
      await this.findCanonicalTarget(canonicalRoot, targetPath, storagePath)
      await unlink(targetPath)
    } catch (error) {
      if (
        isFileSystemError(error, 'ENOENT') ||
        error instanceof PdfStorageNotFoundError
      ) {
        return
      }

      throw error
    }
  }

  private async writeCreatedFile(
    handle: FileHandle,
    targetPath: string,
    storagePath: string,
    contents: Buffer,
  ): Promise<string> {
    let failure: unknown

    try {
      await this.writeContents(handle, contents)
    } catch (error) {
      failure = error
    }

    try {
      await handle.close()
    } catch (error) {
      failure = combineFailures(failure, error)
    }

    if (failure !== undefined) {
      try {
        await unlink(targetPath)
      } catch (error) {
        if (!isFileSystemError(error, 'ENOENT')) {
          failure = combineFailures(failure, error)
        }
      }

      throw failure
    }

    return storagePath
  }

  private async findCanonicalRoot(storagePath: string): Promise<string> {
    try {
      return await realpath(this.rootPath)
    } catch (error) {
      if (isFileSystemError(error, 'ENOENT')) {
        throw new PdfStorageNotFoundError(storagePath)
      }

      throw error
    }
  }

  private async findCanonicalTarget(
    canonicalRoot: string,
    targetPath: string,
    storagePath: string,
  ): Promise<string> {
    let canonicalTarget: string

    try {
      canonicalTarget = await realpath(targetPath)
    } catch (error) {
      if (isFileSystemError(error, 'ENOENT')) {
        throw new PdfStorageNotFoundError(storagePath)
      }

      throw error
    }

    if (!isContainedPath(canonicalRoot, canonicalTarget)) {
      throw new InvalidPdfStoragePathError(storagePath)
    }

    return canonicalTarget
  }

  private resolveFlatPath(canonicalRoot: string, storagePath: string): string {
    this.assertFlatPath(storagePath)
    const targetPath = resolve(canonicalRoot, storagePath)

    if (!isContainedPath(canonicalRoot, targetPath)) {
      throw new InvalidPdfStoragePathError(storagePath)
    }

    return targetPath
  }

  private assertFlatPath(storagePath: string): void {
    if (
      storagePath.length === 0 ||
      storagePath === '.' ||
      storagePath === '..' ||
      isAbsolute(storagePath) ||
      storagePath.includes('/') ||
      storagePath.includes('\\')
    ) {
      throw new InvalidPdfStoragePathError(storagePath)
    }
  }
}

function isContainedPath(rootPath: string, targetPath: string): boolean {
  const relativePath = relative(rootPath, targetPath)

  return (
    relativePath.length > 0 &&
    relativePath !== '..' &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  )
}

function isFileSystemError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  )
}

function combineFailures(current: unknown, next: unknown): unknown {
  return current === undefined
    ? next
    : new AggregateError([current, next], 'PDF storage operation failed')
}
