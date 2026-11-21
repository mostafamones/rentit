import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, loadToken, saveToken, type Me } from './api'

type Session = {
  user: Me | null
  ready: boolean
  signIn(email: string, password: string): Promise<void>
  register(fields: Record<string, string>): Promise<void>
  signOut(): Promise<void>
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    loadToken()
      .then(async (token) => {
        if (!token) return
        try {
          setUser((await api<{ user: Me }>('/me')).user)
        } catch (error) {
          // Only a rejected token signs out; an unreachable server keeps the session for the next launch.
          if (error instanceof ApiError && error.status === 401) await saveToken(null)
        }
      })
      .finally(() => setReady(true))
  }, [])

  const start = async (result: { token: string; user: Me }) => {
    await saveToken(result.token)
    setUser(result.user)
  }

  const value: Session = {
    user, ready,
    signIn: async (email, password) => start(await api('/auth/login', { body: { email, password } })),
    register: async (fields) => start(await api('/auth/register', { body: fields })),
    signOut: async () => {
      await api('/auth/logout', { method: 'POST' }).catch(() => undefined)
      await saveToken(null)
      setUser(null)
    },
  }
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession outside SessionProvider')
  return session
}
