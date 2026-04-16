/* eslint-disable react-refresh/only-export-components */
import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { fetchMe, loginUser, logoutUser, registerUser, setCsrfToken, type User } from './api'

interface AuthContextValue {
  token: string | null
  currentUser: User | null
  isLoading: boolean
  refreshSession: () => Promise<void>
  login: (payload: { email: string; password: string }) => Promise<void>
  register: (payload: { name: string; email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)
const SESSION_SENTINEL = 'cookie-session'

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetchMe(token)
      setCurrentUser(response.user)
      setToken(SESSION_SENTINEL)
      setCsrfToken(response.csrfToken)
    } catch {
      setToken(null)
      setCurrentUser(null)
      setCsrfToken(null)
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  const login = useCallback(async (payload: { email: string; password: string }) => {
    const response = await loginUser(payload)
    setToken(response.token || SESSION_SENTINEL)
    setCurrentUser(response.user)
    setCsrfToken(response.csrfToken)
  }, [])

  const register = useCallback(async (payload: { name: string; email: string; password: string }) => {
    const response = await registerUser(payload)
    setToken(response.token || SESSION_SENTINEL)
    setCurrentUser(response.user)
    setCsrfToken(response.csrfToken)
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutUser(token)
    } catch {
      // Ignore logout errors during local cleanup.
    }

    setToken(null)
    setCurrentUser(null)
    setCsrfToken(null)
  }, [token])

  const value = useMemo(
    () => ({
      token,
      currentUser,
      isLoading,
      refreshSession,
      login,
      register,
      logout,
    }),
    [token, currentUser, isLoading, refreshSession, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
