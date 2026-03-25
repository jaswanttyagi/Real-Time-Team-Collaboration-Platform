import { env, isProduction } from '../config/env.js'

const normalizeOrigin = (value: string) => {
  try {
    return new URL(value).origin
  } catch {
    return value.trim().replace(/\/+$/, '')
  }
}

const configuredOrigins = [
  env.CLIENT_URL,
  ...(env.CLIENT_URLS?.split(',').map((item) => item.trim()).filter(Boolean) ?? []),
].map(normalizeOrigin)

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
