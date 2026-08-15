const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export function validateProviderBaseUrl(value: string): string {
  const normalizedValue = value.trim()
  let url: URL

  try {
    url = new URL(normalizedValue)
  } catch {
    throw new Error('Provider base URL must be a valid absolute URL')
  }

  if (url.username || url.password) {
    throw new Error('Provider base URL must not contain credentials')
  }

  const isSecureRemote = url.protocol === 'https:'
  const isLoopbackHttp = url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)
  if (!isSecureRemote && !isLoopbackHttp) {
    throw new Error('Provider base URL must use HTTPS, except for loopback HTTP services')
  }

  return normalizedValue
}
