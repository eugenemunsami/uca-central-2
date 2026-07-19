import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/ui'

// Landing page for the invite / password-reset email link. Supabase drops the
// user into a live session via the link; here they choose their own password.
export default function SetPassword() {
  const { user, setOwnPassword, signOut } = useAuth()
  const navigate = useNavigate()
  const firstTime = user?.status === 'pending'

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    if (password !== confirm) { setError('The two passwords do not match.'); return }
    if (firstTime && !terms) { setError('Please accept the terms of use to continue.'); return }
    setBusy(true)
    const err = await setOwnPassword(password, firstTime)
    setBusy(false)
    if (err) { setError(err); return }
    navigate('/', { replace: true })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-900 p-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-white/10 bg-ink-800/60 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <h1 className="text-xl text-white">{firstTime ? 'Welcome — set your password' : 'Set a new password'}</h1>
          <p className="mt-1 text-sm text-white/40">
            {firstTime
              ? `Choose a password for ${user?.email ?? 'your account'}. You'll use it to sign in from now on.`
              : 'Choose a new password for your account.'}
          </p>

          <form className="mt-6" onSubmit={submit}>
            <input className="input mb-3" type="password" placeholder="New password" autoComplete="new-password"
              value={password} onChange={e => setPassword(e.target.value)} required />
            <input className="input mb-4" type="password" placeholder="Confirm new password" autoComplete="new-password"
              value={confirm} onChange={e => setConfirm(e.target.value)} required />

            {firstTime && (
              <label className="mb-4 flex items-start gap-2 text-sm text-white/60">
                <input type="checkbox" className="mt-1" checked={terms} onChange={e => setTerms(e.target.checked)} />
                I accept the UCA Central terms of use.
              </label>
            )}

            {error && <div className="mb-3 text-xs text-flame">{error}</div>}

            <button className="btn-primary w-full justify-center" disabled={busy}>
              {busy ? 'Saving...' : firstTime ? 'Set password & continue' : 'Update password'}
            </button>
          </form>

          <button
            onClick={async () => { await signOut(); navigate('/', { replace: true }) }}
            className="mt-4 text-xs text-white/40 hover:text-white"
          >
            Cancel and return to sign in
          </button>
        </div>
      </motion.div>
    </div>
  )
}
