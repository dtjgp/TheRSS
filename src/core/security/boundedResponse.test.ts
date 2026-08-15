import { describe, expect, it } from 'vitest'
import { readBoundedText } from './boundedResponse'

describe('bounded response reader', () => {
  it('returns a response body that stays within the byte limit', async () => {
    const response = new Response('research signal')

    await expect(readBoundedText(response, 64, 'test source')).resolves.toBe('research signal')
  })

  it('rejects a declared oversized body before reading it', async () => {
    const response = new Response('small', { headers: { 'content-length': '1024' } })

    await expect(readBoundedText(response, 32, 'test source')).rejects.toThrow(
      'test source response exceeds the 32 byte safety limit'
    )
  })

  it('stops reading a streamed body once its actual size exceeds the limit', async () => {
    const response = new Response('x'.repeat(65))

    await expect(readBoundedText(response, 64, 'test source')).rejects.toThrow(
      'test source response exceeds the 64 byte safety limit'
    )
  })
})
