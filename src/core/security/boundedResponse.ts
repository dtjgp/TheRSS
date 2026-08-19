function limitError(label: string, maxBytes: number): Error {
  return new Error(`${label} response exceeds the ${maxBytes} byte safety limit`)
}

function assertByteLimit(maxBytes: number): void {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error('Response byte limit must be a positive safe integer')
  }
}

export async function readBoundedText(
  response: Response,
  maxBytes: number,
  label: string,
  encoding: 'utf-8' | 'gb18030' = 'utf-8'
): Promise<string> {
  assertByteLimit(maxBytes)

  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw limitError(label, maxBytes)
  }

  if (!response.body) {
    const text = await response.text()
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw limitError(label, maxBytes)
    return text
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder(encoding)
  const chunks: string[] = []
  let bytesRead = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    bytesRead += value.byteLength
    if (bytesRead > maxBytes) {
      await reader.cancel().catch(() => undefined)
      throw limitError(label, maxBytes)
    }
    chunks.push(decoder.decode(value, { stream: true }))
  }

  chunks.push(decoder.decode())
  return chunks.join('')
}
