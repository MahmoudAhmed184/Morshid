/**
 * Why a body is not usable. The caller maps these onto its own error model;
 * this module has no error vocabulary of its own.
 */
export type BoundedResponseBodyRejection = 'malformed_body' | 'oversized_body'

/**
 * Reads a response body into a string, refusing anything past `maxBytes`.
 *
 * The cap is enforced while streaming rather than after buffering, so an
 * unbounded upstream response can never be materialized in memory first. Every
 * non-completing exit cancels the body: an undici response body above the
 * auto-dump threshold keeps its socket open forever otherwise, and a proxy
 * error page during a gateway outage is exactly that shape. Releasing the
 * reader's lock alone does not release the socket.
 *
 * `createRejection` is required because this helper is shared by callers with
 * disjoint error vocabularies, and a default would let one of them emit an
 * error the other's `catch` cannot recognize.
 */
export async function readBoundedResponseBody(
  response: Response,
  maxBytes: number,
  createRejection: (rejection: BoundedResponseBodyRejection) => Error,
): Promise<string> {
  if (response.body === null) {
    throw createRejection('malformed_body')
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  let drained = false

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        drained = true
        break
      }
      if (!(value instanceof Uint8Array)) {
        throw createRejection('malformed_body')
      }

      byteLength += value.byteLength
      if (byteLength > maxBytes) {
        throw createRejection('oversized_body')
      }
      chunks.push(value)
    }
  } finally {
    // Uniform for every non-completing exit — invalid chunk, oversize, or a
    // stream error.
    if (!drained) {
      await cancelSafely(reader)
    }
    reader.releaseLock()
  }

  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw createRejection('malformed_body')
  }
}

/** Releases a body whose content is not wanted, without leaking its socket. */
export async function discardResponseBody(response: Response): Promise<void> {
  const body = response.body
  if (body === null) {
    return
  }
  await cancelSafely(body)
}

export async function cancelSafely(cancellable: {
  cancel: () => Promise<void>
}): Promise<void> {
  try {
    await cancellable.cancel()
  } catch {
    // Discarding an already-failed body must not mask the original failure.
  }
}
