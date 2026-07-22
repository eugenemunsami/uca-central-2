import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { Logo } from '../components/ui'
import type { Role } from '../lib/types'

const ROLE_ORDER: Role[] = ['exco', 'manco', 'consultant', 'external']
const ROLE_LABEL: Record<Role, string> = {
  exco: 'Exco', manco: 'ManCo', consultant: 'SME Support Unit', external: 'Client / Sponsor / Aggregator',
}

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ------------------------------------------------------------------------ */
/* Particle "WELCOME" intro. Particles assemble into the word, then drift    */
/* apart, then the whole overlay fades out. Plain canvas + rAF, no library.  */
/* ------------------------------------------------------------------------ */
function IntroCanvas({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let raf = 0

    type P = { x: number; y: number; tx: number; ty: number; vx: number; vy: number; size: number; c: string }
    let particles: P[] = []
    const LIME = '#9FD150'

    function buildTargets() {
      const off = document.createElement('canvas')
      off.width = width
      off.height = height
      const octx = off.getContext('2d')
      if (!octx) return
      octx.fillStyle = '#fff'
      octx.textAlign = 'center'
      octx.textBaseline = 'middle'
      const fontSize = Math.min(width * 0.15, 170)
      octx.font = `900 ${fontSize}px Roboto, Arial, sans-serif`
      octx.fillText('WELCOME', width / 2, height / 2)

      const data = octx.getImageData(0, 0, width, height).data
      const pts: { x: number; y: number }[] = []
      const gap = 6
      for (let y = 0; y < height; y += gap) {
        for (let x = 0; x < width; x += gap) {
          if (data[(y * width + x) * 4 + 3] > 128) pts.push({ x, y })
        }
      }
      // Shuffle, then cap the particle count for performance.
      for (let i = pts.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0
        ;[pts[i], pts[j]] = [pts[j], pts[i]]
      }
      const chosen = pts.slice(0, 1200)
      particles = chosen.map(p => ({
        x: Math.random() * width,
        y: Math.random() * height,
        tx: p.x,
        ty: p.y,
        vx: 0,
        vy: 0,
        size: Math.random() * 1.6 + 0.8,
        c: Math.random() < 0.5 ? LIME : '#ffffff',
      }))
    }

    function resize() {
      width = window.innerWidth
      height = window.innerHeight
      canvas!.width = width * dpr
      canvas!.height = height * dpr
      canvas!.style.width = `${width}px`
      canvas!.style.height = `${height}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      buildTargets()
    }
    resize()

    const start = performance.now()
    const DURATION = 2200
    const DISPERSE_AT = 1500

    function frame(now: number) {
      const t = now - start
      const dispersing = t > DISPERSE_AT
      ctx!.clearRect(0, 0, width, height)

      for (const p of particles) {
        if (!dispersing) {
          p.vx += (p.tx - p.x) * 0.08
          p.vy += (p.ty - p.y) * 0.08
        } else {
          // gentle outward drift from centre
          p.vx += (p.x - width / 2) * 0.0009
          p.vy += (p.y - height / 2) * 0.0009
        }
        p.vx *= 0.82
        p.vy *= 0.82
        p.x += p.vx
        p.y += p.vy
      }

      const alpha = t > DURATION - 450 ? Math.max(0, (DURATION - t) / 450) : 1
      ctx!.globalAlpha = alpha
      for (const p of particles) {
        ctx!.fillStyle = p.c
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.globalAlpha = 1

      if (t < DURATION) raf = requestAnimationFrame(frame)
      else onDone()
    }
    raf = requestAnimationFrame(frame)

    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [onDone])

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
}

/* ------------------------------------------------------------------------ */
/* Slow, layered sine-wave gradient background in UCA colours.               */
/* ------------------------------------------------------------------------ */
function WaveBackground() {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = prefersReduced()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let width = 0
    let height = 0
    let raf = 0

    function resize() {
      width = window.innerWidth
      height = window.innerHeight
      canvas!.width = width * dpr
      canvas!.height = height * dpr
      canvas!.style.width = `${width}px`
      canvas!.style.height = `${height}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const waves = [
      { color: '159,209,80', amp: 55, len: 0.0080, speed: 0.00022, y: 0.60, op: 0.10 },
      { color: '25,160,110', amp: 80, len: 0.0060, speed: 0.00016, y: 0.72, op: 0.09 },
      { color: '238,72,35', amp: 48, len: 0.0100, speed: 0.00028, y: 0.84, op: 0.06 },
    ]

    function draw(now: number) {
      ctx!.clearRect(0, 0, width, height)
      for (const w of waves) {
        const grad = ctx!.createLinearGradient(0, height * (w.y - 0.15), 0, height)
        grad.addColorStop(0, `rgba(${w.color},0)`)
        grad.addColorStop(1, `rgba(${w.color},${w.op})`)
        ctx!.beginPath()
        ctx!.moveTo(0, height)
        const phase = now * w.speed
        for (let x = 0; x <= width; x += 8) {
          const y =
            height * w.y +
            Math.sin(x * w.len + phase) * w.amp +
            Math.sin(x * w.len * 0.5 + phase * 1.6) * w.amp * 0.4
          ctx!.lineTo(x, y)
        }
        ctx!.lineTo(width, height)
        ctx!.closePath()
        ctx!.fillStyle = grad
        ctx!.fill()
      }
      if (!reduce) raf = requestAnimationFrame(draw)
    }

    if (reduce) draw(0)
    else raf = requestAnimationFrame(draw)

    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-0" />
}

export default function Login() {
  const { live, people, signInDemo, signIn, sendCode, verifyCode } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'signin' | 'code'>('signin')
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [codeMsg, setCodeMsg] = useState<string | null>(null)
  // Skip straight to the login when reduced-motion is requested.
  const [stage, setStage] = useState<'intro' | 'login'>(() => (prefersReduced() ? 'login' : 'intro'))
  const finishIntro = useCallback(() => setStage('login'), [])

  // Demo: show EVERY account, grouped by role, so every perspective is testable.
  const groups = useMemo(() => ROLE_ORDER.map(role => ({
    role,
    people: people.filter(p => p.role === role && p.active),
  })).filter(g => g.people.length > 0), [people])

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-900 p-6">
      <WaveBackground />

      <AnimatePresence>
        {stage === 'intro' && (
          <motion.div
            key="intro"
            className="fixed inset-0 z-50 cursor-pointer bg-ink-900"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            onClick={finishIntro}
          >
            <IntroCanvas onDone={finishIntro} />
            <div className="pointer-events-none absolute bottom-8 left-0 right-0 text-center text-[10px] uppercase tracking-[0.35em] text-white/25">
              click to skip
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-2xl"
      >
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-white/10 bg-ink-800/60 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <h1 className="text-xl text-white">Sign in</h1>
          <p className="mt-1 text-sm text-white/40">
            {live ? 'Use your UCA credentials.' : 'Demo mode — pick any account to explore that person’s view.'}
          </p>

          {live ? (
            <div className="mt-6 max-w-md">
              {mode === 'signin' ? (
                <form
                  onSubmit={async e => {
                    e.preventDefault()
                    setBusy(true)
                    setError(await signIn(email, password))
                    setBusy(false)
                  }}
                >
                  <input className="input mb-3" type="email" placeholder="you@uca.africa"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                  <input className="input mb-4" type="password" placeholder="Password"
                    value={password} onChange={e => setPassword(e.target.value)} required />
                  {error && <div className="mb-3 text-xs text-flame">{error}</div>}
                  <button className="btn-primary w-full justify-center" disabled={busy}>
                    {busy ? 'Signing in...' : 'Sign in'}
                  </button>
                  <div className="mt-3">
                    <button type="button" className="text-xs text-white/40 hover:text-white"
                      onClick={() => { setMode('code'); setCodeSent(false); setCode(''); setCodeMsg(null) }}>
                      First time here, or forgot your password?
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="label mb-2">Sign in with a code</div>
                  <p className="mb-3 text-xs text-white/40">
                    We’ll email you a code — there’s no link to click, so it works even with strict company email security. Use it to set your password.
                  </p>
                  <input className="input mb-3" type="email" placeholder="you@uca.africa"
                    value={email} onChange={e => setEmail(e.target.value)} required />

                  {!codeSent ? (
                    <button type="button" className="btn-primary w-full justify-center" disabled={busy}
                      onClick={async () => {
                        setCodeMsg(null)
                        if (!email) { setCodeMsg('Enter your email first.'); return }
                        setBusy(true)
                        const err = await sendCode(email)
                        setBusy(false)
                        if (err) { setCodeMsg(err); return }
                        setCodeSent(true)
                        setCodeMsg('Code sent. Check your email (and spam) for the code.')
                      }}>
                      {busy ? 'Sending...' : 'Email me a code'}
                    </button>
                  ) : (
                    <form
                      onSubmit={async e => {
                        e.preventDefault()
                        setCodeMsg(null)
                        setBusy(true)
                        const err = await verifyCode(email, code)
                        setBusy(false)
                        if (err) setCodeMsg('That code didn’t work — it may be mistyped or expired. Try “Resend code”.')
                      }}
                    >
                      <input className="input mb-3 text-center tracking-[0.35em]" inputMode="numeric"
                        autoComplete="one-time-code" maxLength={12} placeholder="Enter the code"
                        value={code} onChange={e => setCode(e.target.value.replace(/\s+/g, ''))} required />
                      <button className="btn-primary w-full justify-center" disabled={busy || code.length < 6}>
                        {busy ? 'Verifying...' : 'Verify & continue'}
                      </button>
                      <div className="mt-3">
                        <button type="button" className="text-xs text-white/40 hover:text-white"
                          onClick={async () => {
                            setCodeMsg(null); setBusy(true)
                            const err = await sendCode(email); setBusy(false)
                            setCodeMsg(err ?? 'A new code is on its way.')
                          }}>
                          Resend code
                        </button>
                      </div>
                    </form>
                  )}

                  {codeMsg && <div className="mt-2 text-xs text-white/50">{codeMsg}</div>}

                  <button type="button" className="mt-4 text-xs text-white/40 hover:text-white"
                    onClick={() => { setMode('signin'); setCodeMsg(null) }}>
                    Back to sign in
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {groups.map(g => (
                <div key={g.role}>
                  <div className="label mb-2">{ROLE_LABEL[g.role]}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {g.people.map(p => (
                      <button
                        key={p.id}
                        onClick={() => signInDemo(p.id)}
                        className="card card-hover flex items-center justify-between bg-ink-700/70 p-3 text-left backdrop-blur-sm"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-white">{p.full_name}</span>
                          <span className="block truncate text-xs text-white/40">{p.discipline}</span>
                        </span>
                        {p.is_admin && (
                          <span className="ml-2 shrink-0 rounded-full bg-lime-soft px-2 py-0.5 text-[10px] uppercase tracking-wider text-lime">
                            admin
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
