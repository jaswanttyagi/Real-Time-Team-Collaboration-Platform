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

const allConfiguredHostsAreRender = configuredOrigins.every((origin) => {
  try {
    return new URL(origin).hostname.endsWith('.onrender.com')
  } catch {
    return false
  }
})

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

  if (!allConfiguredHostsAreRender) {
    return false
  }

  try {
    const { protocol, hostname } = new URL(normalizedOrigin)
    return protocol === 'https:' && hostname.endsWith('.onrender.com')
  } catch {
    return false
  }
}
