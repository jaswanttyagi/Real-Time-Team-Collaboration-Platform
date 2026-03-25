import { env, isProduction } from '../config/env.js'

const looksLikeHostname = (value: string) =>
  !value.startsWith('http://') &&
  !value.startsWith('https://') &&
  !value.startsWith('/') &&
  /^[a-zA-Z0-9.-]+(?::\d+)?$/.test(value)

const normalizeOrigin = (value: string) => {
  const normalizedInput =
    looksLikeHostname(value) ? `${isProduction ? 'https' : 'http'}://${value}` : value

  try {
    return new URL(normalizedInput).origin
  } catch {
    return normalizedInput.trim().replace(/\/+$/, '')
  }
}

const configuredOrigins = [
  env.CLIENT_URL,
  ...(env.CLIENT_URLS?.split(',').map((item) => item.trim()).filter(Boolean) ?? []),
]
  .filter((value): value is string => Boolean(value))
  .map(normalizeOrigin)

export const isAllowedOrigin = (origin?: string) => {
  if (!origin) {
    return true
  }

  const normalizedOrigin = normalizeOrigin(origin)

  if (configuredOrigins.includes(normalizedOrigin)) {
    return true
  }

  if (!isProduction) {
    try {
      const { protocol } = new URL(normalizedOrigin)
      return protocol === 'http:' || protocol === 'https:'
    } catch {
      return false
    }
  }

  try {
    const { protocol, hostname } = new URL(normalizedOrigin)

    if (protocol === 'https:') {
      return true
    }

    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}
