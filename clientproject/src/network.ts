const isLocalHost = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1'

const normalizeOriginLikeUrl = (value: string) => {
  const url = new URL(value, window.location.origin)

  if (
    window.location.protocol === 'https:' &&
    url.protocol === 'http:' &&
    !isLocalHost(url.hostname)
  ) {
    url.protocol = 'https:'
  }

  return url
}

export const resolveApiBaseUrl = () => {
  if (import.meta.env.DEV) {
    return '/api'
  }

  const configured = import.meta.env.VITE_API_URL?.trim()
  if (!configured) {
    return '/api'
  }

  const url = normalizeOriginLikeUrl(configured)

  if (isLocalHost(url.hostname)) {
    return '/api'
  }

  const normalizedPath = url.pathname === '/' ? '/api' : url.pathname.replace(/\/+$/, '')
  url.pathname = normalizedPath.endsWith('/api') ? normalizedPath : `${normalizedPath}/api`

  return url.toString().replace(/\/+$/, '')
}

export const resolveSocketUrl = () => {
  const configuredSocket = import.meta.env.VITE_SOCKET_URL?.trim()
  if (configuredSocket) {
    const socketUrl = normalizeOriginLikeUrl(configuredSocket)

    if (!import.meta.env.DEV && isLocalHost(socketUrl.hostname)) {
      return window.location.origin
    }

    socketUrl.pathname = ''
    socketUrl.search = ''
    socketUrl.hash = ''
    return socketUrl.toString().replace(/\/+$/, '')
  }

  if (!import.meta.env.DEV) {
    const apiUrl = resolveApiBaseUrl()
    if (apiUrl.startsWith('http://') || apiUrl.startsWith('https://')) {
      const resolvedApi = new URL(apiUrl)
      resolvedApi.pathname = ''
      resolvedApi.search = ''
      resolvedApi.hash = ''
      return resolvedApi.toString().replace(/\/+$/, '')
    }
  }

  return import.meta.env.DEV ? 'http://localhost:4000' : window.location.origin
}
