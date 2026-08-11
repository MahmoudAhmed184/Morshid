import {
  STRUCTURED_CHAT_ERROR_CODE,
  StructuredChatTransport,
  type StructuredChatTransportRequest,
} from './structured-chat.transport'

const request: StructuredChatTransportRequest = {
  endpoint: 'http://localhost:8000/v1/chat/completions',
  authorization: null,
  model: 'test-model',
  messages: [
    { role: 'system', content: 'system' },
    { role: 'user', content: 'user' },
  ],
  temperature: 0,
  topP: 1,
  maxCompletionTokens: 128,
  timeoutMs: 30_000,
  maxResponseBytes: 512 * 1_024,
}

describe('StructuredChatTransport', () => {
  it('parses the shared chat-completions response contract', async () => {
    const transport = new StructuredChatTransport(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            model: 'served-model',
            system_fingerprint: 'fingerprint-1',
            choices: [{ message: { content: '{"ok":true}' } }],
            usage: { prompt_tokens: 4, completion_tokens: 5 },
          }),
          { status: 200 },
        ),
      ),
    )

    await expect(transport.complete(request)).resolves.toEqual({
      content: '{"ok":true}',
      model: 'served-model',
      systemFingerprint: 'fingerprint-1',
      inputTokens: 4,
      outputTokens: 5,
    })
  })

  it('preserves HTTP status and retry headers for the shared retry policy', async () => {
    const transport = new StructuredChatTransport(() =>
      Promise.resolve(
        new Response('{}', {
          status: 429,
          headers: { 'retry-after-ms': '75' },
        }),
      ),
    )

    await expect(transport.complete(request)).rejects.toMatchObject({
      code: STRUCTURED_CHAT_ERROR_CODE.RATE_LIMITED,
      status: 429,
      headers: expect.any(Headers) as Headers,
    })
  })

  it('stops a provider call when its shared timeout signal aborts', async () => {
    const timeoutController = new AbortController()
    const transport = new StructuredChatTransport(
      () => new Promise<Response>(() => undefined),
      () => timeoutController.signal,
    )

    const pending = transport.complete(request)
    timeoutController.abort()

    await expect(pending).rejects.toMatchObject({
      code: STRUCTURED_CHAT_ERROR_CODE.TIMEOUT,
    })
  })
})
