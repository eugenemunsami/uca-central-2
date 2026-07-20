import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { LIVE, supabase } from '../lib/supabase'
import { repo, subscribe } from '../lib/repo'
import type { Profile } from '../lib/types'

interface AuthCtx {
  user: Profile | null
  loading: boolean
  live: boolean
  people: Profile[]
  recovery: boolean            // true while a password-reset link session is active
  signInDemo: (id: string) => void
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  sendReset: (email: string) => Promise<string | null>
  sendCode: (email: string) => Promise<string | null>
  verifyCode: (email: string, code: string) => Promise<string | null>
  setOwnPassword: (password: string, acceptTerms: boolean) => Promise<string | null>
  can: (what: 'manage' | 'admin' | 'internal') => boolean
}

const Ctx = createContext<AuthCtx>(null as never)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [people, setPeople] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    const loadPeople = () => repo.profiles().then(setPeople).catch(() => setPeople([]))
    loadPeople()
    const unsubPeople = subscribe(loadPeople)
    if (!LIVE) { setLoading(false); return () => { unsubPeople() } }
    supabase!.auth.getSession().then(async ({ data }) => {
      if (data.session) await loadProfile(data.session.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase!.auth.onAuthStateChange(async (event, session) => {
      // A reset link (and Supabase's invite link) drops the user into a live session;
      // flag recovery so the app routes them to set a password instead of straight in.
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (session) await loadProfile(session.user.id)
      else { setUser(null); setRecovery(false) }
    })
    return () => { unsubPeople(); sub.subscription.unsubscribe() }
  }, [])

  async function loadProfile(id: string) {
    const { data } = await supabase!.from('profiles').select('*').eq('id', id).single()
    setUser((data as Profile) ?? null)
  }

  const value: AuthCtx = {
    user, loading, people, live: LIVE, recovery,
    signInDemo: (id) => setUser(people.find(p => p.id === id) ?? null),
    signIn: async (email, password) => {
      const { error } = await supabase!.auth.signInWithPassword({ email, password })
      return error ? error.message : null
    },
    signOut: async () => {
      if (LIVE) await supabase!.auth.signOut()
      setUser(null)
      setRecovery(false)
    },
    // Email the person a reset link that lands back on /set-password.
    sendReset: async (email) => {
      if (!LIVE) return null
      const { error } = await supabase!.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/set-password`,
      })
      return error ? error.message : null
    },
    // Email the person a 6-digit sign-in code (no link — safe from email
    // link-scanners like Barracuda, which pre-click and burn one-time links).
    // Reuses the recovery/reset email, whose template shows {{ .Token }}.
    sendCode: async (email) => {
      if (!LIVE) return null
      const { error } = await supabase!.auth.resetPasswordForEmail(email)
      return error ? error.message : null
    },
    // Verify the emailed code. On success Supabase opens a recovery session and
    // onAuthStateChange routes the person to the set-password screen.
    verifyCode: async (email, code) => {
      if (!LIVE) return null
      const { error } = await supabase!.auth.verifyOtp({
        email, token: code.trim(), type: 'recovery',
      })
      return error ? error.message : null
    },
    // First login (invite) or reset: set a new password, accept terms, activate the profile.
    setOwnPassword: async (password, acceptTerms) => {
      if (!LIVE) return null
      const { data: sess } = await supabase!.auth.getSession()
      if (!sess.session) return 'Your link has expired. Ask an admin to re-send the invite, or use "Forgot password".'
      const { error } = await supabase!.auth.updateUser({ password })
      if (error) return error.message
      const id = sess.session.user.id
      await supabase!.from('profiles').update({
        status: 'active', active: true, temp_password: null,
        activated_at: new Date().toISOString(),
        ...(acceptTerms ? { terms_accepted_at: new Date().toISOString() } : {}),
      }).eq('id', id)
      await loadProfile(id)
      setRecovery(false)
      return null
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
