import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { LIVE, supabase } from '../lib/supabase'
import { repo, subscribe } from '../lib/repo'
import type { Profile } from '../lib/types'

interface AuthCtx {
  user: Profile | null
  loading: boolean
  live: boolean
  people: Profile[]
  signInDemo: (id: string) => void
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  can: (what: 'manage' | 'admin' | 'internal') => boolean
}

const Ctx = createContext<AuthCtx>(null as never)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [people, setPeople] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPeople = () => repo.profiles().then(setPeople).catch(() => setPeople([]))
    loadPeople()
    const unsubPeople = subscribe(loadPeople)
    if (!LIVE) { setLoading(false); return () => { unsubPeople() } }
    supabase!.auth.getSession().then(async ({ data }) => {
      if (data.session) await loadProfile(data.session.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase!.auth.onAuthStateChange(async (_e, session) => {
      if (session) await loadProfile(session.user.id)
      else setUser(null)
    })
    return () => { unsubPeople(); sub.subscription.unsubscribe() }
  }, [])

  async function loadProfile(id: string) {
    const { data } = await supabase!.from('profiles').select('*').eq('id', id).single()
    setUser((data as Profile) ?? null)
  }

  const value: AuthCtx = {
    user, loading, people, live: LIVE,
    signInDemo: (id) => setUser(people.find(p => p.id === id) ?? null),
    signIn: async (email, password) => {
      const { error } = await supabase!.auth.signInWithPassword({ email, password })
      return error ? error.message : null
    },
    signOut: async () => {
      if (LIVE) await supabase!.auth.signOut()
      setUser(null)
    },
    can: (what) => {
      if (!user) return false
      if (what === 'admin') return user.is_admin
      if (what === 'manage') return user.role === 'manco' || user.role === 'exco'
      return user.role !== 'external'
    },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
