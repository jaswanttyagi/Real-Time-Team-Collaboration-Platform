import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { api, configureApiAuth, setAccessToken as setApiAccessToken } from './api'
import type { User } from './types'

type AuthContextValue = {
  user: User | null
  accessToken: string | null
  isBooting: boolean
  isAuthenticated: boolean
  login: (payload: { email: string; password: string }) => Promise<void>
  signup: (payload: {
    name: string
    email: string
    password: string
    role: 'ADMIN'
  }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isBooting, setIsBooting] = useState(true)

  const clearAuth = useCallback(() => {
    setUser(null)
    setAccessToken(null)
    setApiAccessToken(null)
    localStorage.removeItem('clientproject:last-activity-at')
  }, [])

  const refreshSession = useCallback(async () => {
    try {
      const refreshResult = await api.refresh()
      setAccessToken(refreshResult.accessToken)
      setApiAccessToken(refreshResult.accessToken)

      const meResult = await api.me()
      setUser(meResult.user)
      return refreshResult.accessToken
    } catch {
      clearAuth()
      return null
    }
  }, [clearAuth])

  useEffect(() => {
    configureApiAuth({
      refreshAccessToken: refreshSession,
      onUnauthorized: clearAuth,
    })

    void refreshSession().finally(() => {
      setIsBooting(false)
    })
  }, [clearAuth, refreshSession])

  const login = useCallback(async (payload: { email: string; password: string }) => {
    const result = await api.login(payload)
    setUser(result.user)
    setAccessToken(result.accessToken)
    setApiAccessToken(result.accessToken)
  }, [])

  const signup = useCallback(
    async (payload: {
      name: string
      email: string
      password: string
      role: 'ADMIN'
    }) => {
      const result = await api.register(payload)
      setUser(result.user)
      setAccessToken(result.accessToken)
      setApiAccessToken(result.accessToken)
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      clearAuth()
    }
  }, [clearAuth])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isBooting,
      isAuthenticated: Boolean(user && accessToken),
      login,
      signup,
      logout,
    }),
    [accessToken, isBooting, login, logout, signup, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
