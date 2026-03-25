const isLocalHost = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1'
const defaultHostedApiOrigins = ['https://real-time-collab-api.onrender.com']
const renderWakeRetryCount = 10
const renderWakeRetryDelayMs = 5000

const looksLikeHostname = (value: string) =>
  !value.startsWith('http://') &&
  !value.startsWith('https://') &&
  !value.startsWith('/') &&
  /^[a-zA-Z0-9.-]+(?::\d+)?$/.test(value)

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)))

const normalizeOriginLikeUrl = (value: string) => {
  const normalizedInput = looksLikeHostname(value)
    ? `${window.location.protocol === 'https:' ? 'https' : 'http'}://${value}`
    : value

  const url = new URL(normalizedInput, window.location.origin)

  if (
    window.location.protocol === 'https:' &&
    url.protocol === 'http:' &&
    !isLocalHost(url.hostname)
  ) {
    url.protocol = 'https:'
  }

  return url
}

const toApiBaseUrl = (value: string) => {
  const url = normalizeOriginLikeUrl(value)

  if (!import.meta.env.DEV && isLocalHost(url.hostname)) {
    return '/api'
  }

  const normalizedPath = url.pathname === '/' ? '/api' : url.pathname.replace(/\/+$/, '')
  url.pathname = normalizedPath.endsWith('/api') ? normalizedPath : `${normalizedPath}/api`
  url.search = ''
  url.hash = ''

  return url.toString().replace(/\/+$/, '')
}

const getConfiguredApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_URL?.trim()
  if (!configured) {
    return null
  }

  const url = normalizeOriginLikeUrl(configured)

  if (!import.meta.env.DEV && isLocalHost(url.hostname)) {
    return null
  }

  return toApiBaseUrl(url.toString())
}

const getRenderDerivedApiBaseUrls = () => {
  if (import.meta.env.DEV || !window.location.hostname.endsWith('.onrender.com')) {
    return []
  }

  const candidates = new Set<string>()
  const protocol = window.location.protocol === 'https:' ? 'https' : 'http'
  const hostname = window.location.hostname

  const addCandidate = (nextHostname: string) => {
    if (nextHostname !== hostname) {
      candidates.add(toApiBaseUrl(`${protocol}://${nextHostname}`))
    }
  }

  addCandidate(hostname.replace('-web.', '-api.'))
  addCandidate(hostname.replace('-frontend.', '-backend.'))
  addCandidate(hostname.replace('-frontend.', '-api.'))
  addCandidate(hostname.replace('-client.', '-api.'))
  addCandidate(hostname.replace('-app.', '-api.'))

  return Array.from(candidates)
}

const getBundledFallbackApiBaseUrls = () => defaultHostedApiOrigins.map((origin) => toApiBaseUrl(origin))

const buildApiBaseCandidates = () => {
  if (import.meta.env.DEV) {
    return ['/api']
  }

  const configured = getConfiguredApiBaseUrl()
  return unique([
    ...(configured ? [configured] : []),
    ...getRenderDerivedApiBaseUrls(),
    ...getBundledFallbackApiBaseUrls(),
    '/api',
  ])
}

const getHealthUrl = (apiBaseUrl: string) => {
  if (apiBaseUrl.startsWith('/')) {
    return '/health'
  }

  const url = new URL(apiBaseUrl)
  url.pathname = '/health'
  url.search = ''
  url.hash = ''
  return url.toString()
}

const isHealthPayload = (payload: unknown) => {
  if (typeof payload !== 'object' || payload === null) {
    return false
  }

  return 'success' in payload && ('data' in payload || 'error' in payload)
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const probeApiBaseUrl = async (apiBaseUrl: string) => {
  try {
    const response = await fetch(getHealthUrl(apiBaseUrl), {
      method: 'GET',
      credentials: 'include',
    })

    if (response.status === 503 && response.headers.get('x-render-routing') === 'suspend') {
      return 'waking' as const
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      return 'unreachable' as const
    }

    const payload = await response.json().catch(() => null)
    return isHealthPayload(payload) ? ('ready' as const) : ('unreachable' as const)
  } catch {
    return 'unreachable' as const
  }
}

let activeApiBaseUrl = buildApiBaseCandidates()[0] ?? '/api'
let confirmedApiBaseUrl: string | null = null
let apiDiscoveryPromise: Promise<string> | null = null

export const resolveApiBaseUrl = () => confirmedApiBaseUrl ?? activeApiBaseUrl

export const ensureApiBaseUrl = async () => {
  if (confirmedApiBaseUrl) {
    return confirmedApiBaseUrl
  }

  if (apiDiscoveryPromise) {
    return apiDiscoveryPromise
  }

  apiDiscoveryPromise = (async () => {
    for (const candidate of buildApiBaseCandidates()) {
      activeApiBaseUrl = candidate

      for (let attempt = 0; attempt < renderWakeRetryCount; attempt += 1) {
        const probeResult = await probeApiBaseUrl(candidate)

        if (probeResult === 'ready') {
          confirmedApiBaseUrl = candidate
          return candidate
        }

        if (probeResult !== 'waking') {
          break
        }

        await sleep(renderWakeRetryDelayMs)
      }
    }

    return activeApiBaseUrl
  })()

  const resolved = await apiDiscoveryPromise
  apiDiscoveryPromise = null
  return resolved
}

const getConfiguredSocketUrl = () => {
  const configuredSocket = import.meta.env.VITE_SOCKET_URL?.trim()
  if (!configuredSocket) {
    return null
  }

  const socketUrl = normalizeOriginLikeUrl(configuredSocket)

  if (!import.meta.env.DEV && isLocalHost(socketUrl.hostname)) {
    return null
  }

  socketUrl.pathname = ''
  socketUrl.search = ''
  socketUrl.hash = ''
  return socketUrl.toString().replace(/\/+$/, '')
}

const toSocketUrl = (apiBaseUrl: string) => {
  if (apiBaseUrl.startsWith('/')) {
    return window.location.origin
  }

  const resolvedApi = new URL(apiBaseUrl)
  resolvedApi.pathname = ''
  resolvedApi.search = ''
  resolvedApi.hash = ''
  return resolvedApi.toString().replace(/\/+$/, '')
}

export const resolveSocketUrl = () => {
  const configuredSocketUrl = getConfiguredSocketUrl()
  if (configuredSocketUrl) {
    return configuredSocketUrl
  }

  return import.meta.env.DEV ? 'http://localhost:4000' : toSocketUrl(resolveApiBaseUrl())
}

export const ensureSocketUrl = async () => {
  const configuredSocketUrl = getConfiguredSocketUrl()
  if (configuredSocketUrl) {
    return configuredSocketUrl
  }

  return import.meta.env.DEV ? 'http://localhost:4000' : toSocketUrl(await ensureApiBaseUrl())
}
